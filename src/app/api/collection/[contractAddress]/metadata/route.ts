import { NextResponse } from 'next/server';
import { Alchemy, Network } from 'alchemy-sdk';
import { parseAbiItem, type Address } from 'viem';
import { getProviderWithRetry, retryContractCall } from '~/lib/nft-metadata';

// Initialize Alchemy SDK (server-side only)
const alchemy = new Alchemy({
  apiKey: process.env.ALCHEMY_API_KEY,
  network: Network.BASE_MAINNET,
});

// Add ERC721 and ERC1155 ABI items for metadata fetching
const ERC721_METADATA_ABI = [
  parseAbiItem('function name() view returns (string)'),
  parseAbiItem('function symbol() view returns (string)'),
] as const;

const ERC1155_METADATA_ABI = [
  parseAbiItem('function name() view returns (string)'),
  parseAbiItem('function symbol() view returns (string)'),
] as const;

// Helper function to fetch metadata on-chain
async function fetchOnChainMetadata(contractAddress: string) {
  try {
    const client = await getProviderWithRetry();
    
    // Try ERC721 first
    try {
      const [name, symbol] = await Promise.all([
        retryContractCall<string>(
          client,
          contractAddress as Address,
          ERC721_METADATA_ABI,
          'name',
          []
        ),
        retryContractCall<string>(
          client,
          contractAddress as Address,
          ERC721_METADATA_ABI,
          'symbol',
          []
        )
      ]);
      
      return {
        name: name || null,
        symbol: symbol || null,
        totalSupply: null, // We don't know the total supply on-chain
        contractType: 'ERC721' as const,
      };
    } catch {
      // If ERC721 fails, try ERC1155
      try {
        const [name, symbol] = await Promise.all([
          retryContractCall<string>(
            client,
            contractAddress as Address,
            ERC1155_METADATA_ABI,
            'name',
            []
          ),
          retryContractCall<string>(
            client,
            contractAddress as Address,
            ERC1155_METADATA_ABI,
            'symbol',
            []
          )
        ]);
        
        return {
          name: name || null,
          symbol: symbol || null,
          totalSupply: null, // We don't know the total supply on-chain
          contractType: 'ERC1155' as const,
        };
      } catch (error) {
        console.error('❌ Error fetching ERC1155 metadata on-chain:', {
          error: error instanceof Error ? error.message : 'Unknown error',
          contractAddress,
        });
        throw error;
      }
    }
  } catch (error) {
    console.error('❌ Error in on-chain metadata fetch:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      contractAddress,
    });
    throw error;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contractAddress: string }> }
) {
  const { contractAddress } = await params;
  
  if (!contractAddress) {
    return NextResponse.json(
      { error: 'Contract address is required' },
      { status: 400 }
    );
  }

  try {
    try {
      // Try Alchemy first
      const metadata = await alchemy.nft.getContractMetadata(contractAddress);
      
      // Determine contract type based on metadata
      let contractType: 'ERC721' | 'ERC1155' | 'UNKNOWN' = 'UNKNOWN';
      if (metadata.tokenType === 'ERC721') {
        contractType = 'ERC721';
      } else if (metadata.tokenType === 'ERC1155') {
        contractType = 'ERC1155';
      }

      return NextResponse.json({
        name: metadata.name ?? null,
        symbol: metadata.symbol ?? null,
        totalSupply: metadata.totalSupply ?? null,
        contractType,
      });
    } catch (error) {
      console.log('⚠️ Alchemy metadata fetch failed, trying on-chain:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        address: contractAddress,
      });

      // If Alchemy fails, try on-chain
      const onChainMetadata = await fetchOnChainMetadata(contractAddress);
      return NextResponse.json(onChainMetadata);
    }
  } catch (error) {
    console.error('❌ Error fetching contract metadata:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      address: contractAddress,
    });
    return NextResponse.json(
      { error: 'Failed to fetch contract metadata' },
      { status: 500 }
    );
  }
} 