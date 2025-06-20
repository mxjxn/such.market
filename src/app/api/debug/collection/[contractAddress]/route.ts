import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '~/lib/supabase';
import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { base } from 'viem/chains';

const supabase = getSupabaseClient();

// Initialize viem client
const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_MAINNET_RPC!),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contractAddress: string }> }
) {
  try {
    const { contractAddress } = await params;
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    const testTokenId = searchParams.get('testTokenId') || '0';

    console.log(`🔍 [Debug] Debugging collection: ${contractAddress}`);

    // Get collection info
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select('*')
      .eq('contract_address', contractAddress.toLowerCase())
      .single();

    if (collectionError) {
      console.error('❌ [Debug] Collection error:', collectionError);
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    console.log('📋 [Debug] Collection info:', {
      id: collection.id,
      name: collection.name,
      token_type: collection.token_type,
      total_supply: collection.total_supply,
      verified: collection.verified,
      last_refresh_at: collection.last_refresh_at,
    });

    // Get NFTs in collection
    const { data: nfts, error: nftsError } = await supabase
      .from('nfts')
      .select('*')
      .eq('collection_id', collection.id)
      .order('token_id', { ascending: true });

    if (nftsError) {
      console.error('❌ [Debug] NFTs error:', nftsError);
      return NextResponse.json({ error: 'Failed to fetch NFTs' }, { status: 500 });
    }

    console.log(`📊 [Debug] Found ${nfts?.length || 0} NFTs in database`);

    // Test blockchain calls
    const blockchainTests = {
      erc721: {} as any,
      erc1155: {} as any,
    };

    // Test ERC721 calls
    try {
      console.log(`🔍 [Debug] Testing ERC721 ownerOf for token ${testTokenId}...`);
      const owner = await client.readContract({
        address: contractAddress as Address,
        abi: [parseAbiItem('function ownerOf(uint256 tokenId) view returns (address)')],
        functionName: 'ownerOf',
        args: [BigInt(testTokenId)],
      });
      blockchainTests.erc721.ownerOf = {
        success: true,
        owner: owner,
        tokenId: testTokenId,
      };
      console.log(`✅ [Debug] ERC721 ownerOf success: ${owner}`);
    } catch (error) {
      blockchainTests.erc721.ownerOf = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenId: testTokenId,
      };
      console.log(`❌ [Debug] ERC721 ownerOf failed:`, error instanceof Error ? error.message : 'Unknown error');
    }

    // Test ERC1155 calls
    try {
      console.log(`🔍 [Debug] Testing ERC1155 balanceOf for token ${testTokenId}...`);
      const balance = await client.readContract({
        address: contractAddress as Address,
        abi: [parseAbiItem('function balanceOf(address account, uint256 id) view returns (uint256)')],
        functionName: 'balanceOf',
        args: [userAddress as Address || '0x0000000000000000000000000000000000000000' as Address, BigInt(testTokenId)],
      });
      blockchainTests.erc1155.balanceOf = {
        success: true,
        balance: Number(balance),
        tokenId: testTokenId,
        userAddress: userAddress,
      };
      console.log(`✅ [Debug] ERC1155 balanceOf success: ${balance}`);
    } catch (error) {
      blockchainTests.erc1155.balanceOf = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenId: testTokenId,
        userAddress: userAddress,
      };
      console.log(`❌ [Debug] ERC1155 balanceOf failed:`, error instanceof Error ? error.message : 'Unknown error');
    }

    // Test totalSupply for ERC1155
    try {
      console.log(`🔍 [Debug] Testing ERC1155 totalSupply for token ${testTokenId}...`);
      const totalSupply = await client.readContract({
        address: contractAddress as Address,
        abi: [parseAbiItem('function totalSupply(uint256 id) view returns (uint256)')],
        functionName: 'totalSupply',
        args: [BigInt(testTokenId)],
      });
      blockchainTests.erc1155.totalSupply = {
        success: true,
        totalSupply: Number(totalSupply),
        tokenId: testTokenId,
      };
      console.log(`✅ [Debug] ERC1155 totalSupply success: ${totalSupply}`);
    } catch (error) {
      blockchainTests.erc1155.totalSupply = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenId: testTokenId,
      };
      console.log(`❌ [Debug] ERC1155 totalSupply failed:`, error instanceof Error ? error.message : 'Unknown error');
    }

    // Test ownership for user if provided
    const ownershipTests = [];
    if (userAddress) {
      const testTokenIds = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50'];
      
      for (const tokenId of testTokenIds) {
        try {
          if (collection.token_type === 'ERC721') {
            const owner = await client.readContract({
              address: contractAddress as Address,
              abi: [parseAbiItem('function ownerOf(uint256 tokenId) view returns (address)')],
              functionName: 'ownerOf',
              args: [BigInt(tokenId)],
            });
            ownershipTests.push({
              tokenId,
              owner: owner.toLowerCase(),
              userAddress: userAddress.toLowerCase(),
              isOwned: owner.toLowerCase() === userAddress.toLowerCase(),
              type: 'ERC721',
            });
          } else if (collection.token_type === 'ERC1155') {
            const balance = await client.readContract({
              address: contractAddress as Address,
              abi: [parseAbiItem('function balanceOf(address account, uint256 id) view returns (uint256)')],
              functionName: 'balanceOf',
              args: [userAddress as Address, BigInt(tokenId)],
            });
            ownershipTests.push({
              tokenId,
              balance: Number(balance),
              userAddress: userAddress.toLowerCase(),
              isOwned: Number(balance) > 0,
              type: 'ERC1155',
            });
          }
        } catch (error) {
          ownershipTests.push({
            tokenId,
            error: error instanceof Error ? error.message : 'Unknown error',
            userAddress: userAddress.toLowerCase(),
            isOwned: false,
            type: collection.token_type,
          });
        }
      }
    }

    return NextResponse.json({
      collection,
      nfts: nfts || [],
      nftCount: nfts?.length || 0,
      blockchainTests,
      ownershipTests,
      debug: {
        contractAddress,
        userAddress,
        testTokenId,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('❌ [Debug] Error in debug endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 