import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { base } from 'viem/chains';

// Initialize viem client
const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_MAINNET_RPC!),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contractAddress: string; tokenId: string }> }
) {
  try {
    const { contractAddress, tokenId } = await params;
    
    console.log(`🔍 [Debug URI] Checking contract URI for ${contractAddress}, token ${tokenId}`);
    
    const results = {
      erc721: {} as any,
      erc1155: {} as any,
      metadata: {} as any,
    };
    
    // Try ERC721 tokenURI first
    console.log(`🔍 [Debug URI] Trying ERC721 tokenURI...`);
    try {
      const tokenURI = await client.readContract({
        address: contractAddress as Address,
        abi: [parseAbiItem('function tokenURI(uint256 tokenId) view returns (string)')],
        functionName: 'tokenURI',
        args: [BigInt(tokenId)],
      });
      results.erc721 = {
        success: true,
        uri: tokenURI,
      };
      console.log(`✅ [Debug URI] ERC721 tokenURI: ${tokenURI}`);
    } catch (error) {
      results.erc721 = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      console.log(`❌ [Debug URI] ERC721 tokenURI failed:`, error instanceof Error ? error.message : 'Unknown error');
    }
    
    // Try ERC1155 uri
    console.log(`🔍 [Debug URI] Trying ERC1155 uri...`);
    try {
      const uri = await client.readContract({
        address: contractAddress as Address,
        abi: [parseAbiItem('function uri(uint256 tokenId) view returns (string)')],
        functionName: 'uri',
        args: [BigInt(tokenId)],
      });
      results.erc1155 = {
        success: true,
        uri: uri,
      };
      console.log(`✅ [Debug URI] ERC1155 uri: ${uri}`);
      
      // Test the {id} replacement
      if (uri.includes('{id}')) {
        const hexId = BigInt(tokenId).toString(16).padStart(64, '0');
        const processedUri = uri.replace('{id}', hexId);
        results.erc1155.hexId = hexId;
        results.erc1155.processedUri = processedUri;
        console.log(`🔄 [Debug URI] Replaced {id} with hex: ${hexId}`);
        console.log(`🔗 [Debug URI] Processed URI: ${processedUri}`);
        
        // Try to fetch the metadata
        console.log(`🔍 [Debug URI] Testing metadata fetch...`);
        try {
          const response = await fetch(processedUri);
          console.log(`📊 [Debug URI] Response status: ${response.status}`);
          results.metadata = {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
          };
          
          if (response.ok) {
            const text = await response.text();
            console.log(`📄 [Debug URI] Response body (first 500 chars):`, text.substring(0, 500));
            results.metadata.body = text.substring(0, 1000); // First 1000 chars
            
            try {
              const metadata = JSON.parse(text);
              results.metadata.parsed = metadata;
              console.log(`✅ [Debug URI] Parsed metadata:`, metadata);
            } catch (parseError) {
              results.metadata.parseError = parseError instanceof Error ? parseError.message : 'Unknown error';
              console.log(`❌ [Debug URI] JSON parse failed:`, parseError instanceof Error ? parseError.message : 'Unknown error');
            }
          } else {
            console.log(`❌ [Debug URI] HTTP error: ${response.status} ${response.statusText}`);
          }
        } catch (fetchError) {
          results.metadata.fetchError = fetchError instanceof Error ? fetchError.message : 'Unknown error';
          console.log(`❌ [Debug URI] Fetch failed:`, fetchError instanceof Error ? fetchError.message : 'Unknown error');
        }
      }
    } catch (error) {
      results.erc1155 = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      console.log(`❌ [Debug URI] ERC1155 uri failed:`, error instanceof Error ? error.message : 'Unknown error');
    }
    
    return NextResponse.json({
      contractAddress,
      tokenId,
      results,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('❌ [Debug URI] Error in debug URI endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 