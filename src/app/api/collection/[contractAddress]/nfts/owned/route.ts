import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '~/lib/supabase';
import { getCollectionByAddress, fetchAndStoreCollectionMetadata } from '~/lib/db/collections';
import { createPublicClient, http, parseAbiItem } from 'viem';
import { base } from 'viem/chains';

// Initialize viem client for on-chain calls
const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_MAINNET_RPC!),
});

interface NFT {
  id: string;
  collection_id: string;
  token_id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  metadata: Record<string, unknown> | null;
  attributes: Array<{ trait_type: string; value: string | number }> | null;
  media: Array<Record<string, unknown>> | null;
  owner_address: string | null;
  last_owner_check_at: string | null;
  created_at: string;
  updated_at: string;
  balance?: number;
  editionSupply?: number | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contractAddress: string }> }
) {
  try {
    const { contractAddress } = await params;
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    // Validate contract address
    if (!contractAddress || !contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Invalid contract address' },
        { status: 400 }
      );
    }

    // Validate user address
    if (!userAddress || !userAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return NextResponse.json(
        { error: 'Valid user address is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 [Owned NFTs] Getting NFTs owned by ${userAddress} in collection ${contractAddress}`);

    // Step 1: Check if collection exists in database
    let collection = await getCollectionByAddress(contractAddress.toLowerCase());
    
    if (!collection) {
      console.log(`🔄 [Owned NFTs] Collection not found, fetching metadata...`);
      try {
        collection = await fetchAndStoreCollectionMetadata(contractAddress);
      } catch (error) {
        console.error('❌ [Owned NFTs] Failed to fetch collection metadata:', error);
        return NextResponse.json(
          { error: 'Collection not found and could not be fetched' },
          { status: 404 }
        );
      }
    }

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    console.log(`📋 [Owned NFTs] Collection token type: ${collection.token_type}`);

    // Step 2: Determine token type and fetch ownership data accordingly
    let ownedNFTs: NFT[] = [];
    const supabase = getSupabaseClient();

    if (collection.token_type === 'ERC721') {
      // For ERC-721, we can use ownerOf to check ownership
      console.log(`🔍 [Owned NFTs] Using ERC-721 ownerOf method`);
      
      // Get all NFTs from the collection
      const { data: allNFTs, error: nftsError } = await supabase
        .from('nfts')
        .select('*')
        .eq('collection_id', collection.id)
        .order('token_id', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (nftsError) {
        console.error('❌ [Owned NFTs] Error fetching NFTs:', nftsError);
        return NextResponse.json(
          { error: 'Failed to fetch NFTs' },
          { status: 500 }
        );
      }

      console.log(`📊 [Owned NFTs] Found ${allNFTs?.length || 0} NFTs in database for ERC721 collection`);
      console.log(`📋 [Owned NFTs] Database token IDs:`, allNFTs?.map(nft => nft.token_id) || []);

      // Check ownership for each NFT using ownerOf
      const ownershipChecks = await Promise.allSettled(
        (allNFTs || []).map(async (nft) => {
          try {
            console.log(`🔍 [Owned NFTs] Checking ownership for token ${nft.token_id}...`);
            const owner = await publicClient.readContract({
              address: contractAddress as `0x${string}`,
              abi: [parseAbiItem('function ownerOf(uint256 tokenId) view returns (address)')],
              functionName: 'ownerOf',
              args: [BigInt(nft.token_id)],
            });

            const ownerLower = owner.toLowerCase();
            const userLower = userAddress.toLowerCase();
            const isOwned = ownerLower === userLower;
            
            console.log(`👤 [Owned NFTs] Token ${nft.token_id} owner: ${ownerLower}, user: ${userLower}, owned: ${isOwned}`);

            return {
              nft,
              owner: ownerLower,
              isOwned,
            };
          } catch (error) {
            console.error(`❌ [Owned NFTs] Error checking ownership for token ${nft.token_id}:`, {
              error: error instanceof Error ? error.message : 'Unknown error',
              type: error instanceof Error ? error.name : typeof error,
              stack: error instanceof Error ? error.stack : undefined,
            });
            return {
              nft,
              owner: null,
              isOwned: false,
            };
          }
        })
      );

      // Filter to only owned NFTs
      ownedNFTs = ownershipChecks
        .filter((result): result is PromiseFulfilledResult<{ nft: NFT; owner: string | null; isOwned: boolean }> => result.status === 'fulfilled')
        .map(result => result.value)
        .filter(item => item.isOwned)
        .map(item => ({
          ...item.nft,
          owner_address: item.owner,
        }));

      // If we found no owned NFTs in the database, try to discover what token IDs exist
      if (ownedNFTs.length === 0) {
        console.log(`🔍 [Owned NFTs] No owned NFTs found in database, attempting to discover existing token IDs...`);
        
        // Try common token IDs for ERC721 collections
        const commonTokenIds = ['0', '1', '2', '3', '4', '5', '10', '100', '1000'];
        
        for (const tokenId of commonTokenIds) {
          try {
            console.log(`🔍 [Owned NFTs] Checking if ERC721 token ${tokenId} exists...`);
            const owner = await publicClient.readContract({
              address: contractAddress as `0x${string}`,
              abi: [parseAbiItem('function ownerOf(uint256 tokenId) view returns (address)')],
              functionName: 'ownerOf',
              args: [BigInt(tokenId)],
            });

            const ownerLower = owner.toLowerCase();
            const userLower = userAddress.toLowerCase();
            const isOwned = ownerLower === userLower;
            
            console.log(`👤 [Owned NFTs] Token ${tokenId} owner: ${ownerLower}, user: ${userLower}, owned: ${isOwned}`);
            
            if (isOwned) {
              console.log(`✅ [Owned NFTs] Found owned token ${tokenId}`);
              // Create a minimal NFT object for the owned token
              ownedNFTs.push({
                id: `discovered-${tokenId}`,
                collection_id: collection.id,
                token_id: tokenId,
                title: `Token ${tokenId}`,
                description: null,
                image_url: null,
                thumbnail_url: null,
                metadata: null,
                attributes: null,
                media: null,
                owner_address: ownerLower,
                last_owner_check_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          } catch (error) {
            console.log(`⚠️ [Owned NFTs] Token ${tokenId} doesn't exist or error:`, error instanceof Error ? error.message : 'Unknown error');
          }
        }
      }

    } else if (collection.token_type === 'ERC1155') {
      // For ERC-1155, we need to use balanceOfBatch to check ownership efficiently
      console.log(`🔍 [Owned NFTs] Using ERC-1155 balanceOfBatch method`);
      
      // Get all NFTs from the collection
      const { data: allNFTs, error: nftsError } = await supabase
        .from('nfts')
        .select('*')
        .eq('collection_id', collection.id)
        .order('token_id', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (nftsError) {
        console.error('❌ [Owned NFTs] Error fetching NFTs:', nftsError);
        return NextResponse.json(
          { error: 'Failed to fetch NFTs' },
          { status: 500 }
        );
      }

      const tokenIds = (allNFTs || []).map(nft => nft.token_id);
      const userAddresses = tokenIds.map(() => userAddress as `0x${string}`);

      let balances: bigint[] = [];
      if (tokenIds.length > 0) {
        try {
          // Try balanceOfBatch
          balances = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: [
              parseAbiItem('function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])'),
            ],
            functionName: 'balanceOfBatch',
            args: [userAddresses, tokenIds.map(id => BigInt(id))],
          }) as bigint[];
          console.log(`💰 [Owned NFTs] balanceOfBatch result:`, balances.map(b => b.toString()));
        } catch (error) {
          console.error('❌ [Owned NFTs] balanceOfBatch failed, falling back to balanceOf loop:', error);
          // Fallback: check individually
          balances = await Promise.all(tokenIds.map(async (id) => {
            try {
              return await publicClient.readContract({
                address: contractAddress as `0x${string}`,
                abi: [parseAbiItem('function balanceOf(address account, uint256 id) view returns (uint256)')],
                functionName: 'balanceOf',
                args: [userAddress as `0x${string}`, BigInt(id)],
              }) as bigint;
            } catch {
              return 0n;
            }
          }));
        }
      }

      // Try to get editionSupply for each tokenId
      const editionSupplies: Record<string, number | null> = {};
      await Promise.all(tokenIds.map(async (id) => {
        try {
          const supply = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: [parseAbiItem('function editionSupply(uint256 id) view returns (uint256)')],
            functionName: 'editionSupply',
            args: [BigInt(id)],
          });
          editionSupplies[id] = Number(supply);
        } catch (error) {
          editionSupplies[id] = null;
        }
      }));

      // Filter to only owned NFTs and include balance and editionSupply information
      ownedNFTs = (allNFTs || []).map((nft, i) => {
        const balance = Number(balances[i] || 0);
        return balance > 0 ? {
          ...nft,
          owner_address: userAddress,
          balance,
          editionSupply: editionSupplies[nft.token_id] ?? undefined,
        } : null;
      }).filter(Boolean) as NFT[];

      // If we found no owned NFTs in the database, try to discover what token IDs exist
      if (ownedNFTs.length === 0 && (allNFTs?.length || 0) === 0) {
        console.log(`🔍 [Owned NFTs] No NFTs in database, attempting to discover existing token IDs...`);
        
        // Try common token IDs for ERC1155 collections
        const commonTokenIds = ['0', '1', '2', '3', '4', '5', '10', '100', '1000'];
        const userAddressesBatch = commonTokenIds.map(() => userAddress as `0x${string}`);
        let batchBalances: bigint[] = [];
        try {
          batchBalances = await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: [
              parseAbiItem('function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])'),
            ],
            functionName: 'balanceOfBatch',
            args: [userAddressesBatch, commonTokenIds.map(id => BigInt(id))],
          }) as bigint[];
        } catch (error) {
          // fallback to individual
          batchBalances = await Promise.all(commonTokenIds.map(async (id) => {
            try {
              return await publicClient.readContract({
                address: contractAddress as `0x${string}`,
                abi: [parseAbiItem('function balanceOf(address account, uint256 id) view returns (uint256)')],
                functionName: 'balanceOf',
                args: [userAddress as `0x${string}`, BigInt(id)],
              }) as bigint;
            } catch {
              return 0n;
            }
          }));
        }
        await Promise.all(commonTokenIds.map(async (id) => {
          try {
            const supply = await publicClient.readContract({
              address: contractAddress as `0x${string}`,
              abi: [parseAbiItem('function editionSupply(uint256 id) view returns (uint256)')],
              functionName: 'editionSupply',
              args: [BigInt(id)],
            });
            editionSupplies[id] = Number(supply);
          } catch (error) {
            editionSupplies[id] = null;
          }
        }));
        for (let i = 0; i < commonTokenIds.length; i++) {
          const balance = Number(batchBalances[i] || 0);
          if (balance > 0) {
            const tokenId = commonTokenIds[i];
            console.log(`✅ [Owned NFTs] Found owned token ${tokenId} with balance ${balance}`);
            
            // Try to fetch metadata for discovered NFTs
            let metadata = null;
            let imageUrl = null;
            let title = `Token ${tokenId}`;
            
            try {
              console.log(`🔍 [Owned NFTs] Fetching metadata for discovered token ${tokenId}...`);
              console.log(`📦 [Owned NFTs] Importing fetchAndStoreNFTMetadata...`);
              const { fetchAndStoreNFTMetadata } = await import('~/lib/nft-metadata');
              console.log(`✅ [Owned NFTs] Successfully imported fetchAndStoreNFTMetadata`);
              console.log(`🔧 [Owned NFTs] Calling fetchAndStoreNFTMetadata with:`, {
                contractAddress,
                tokenIds: [tokenId],
                collectionId: collection.id,
              });
              await fetchAndStoreNFTMetadata(contractAddress, [tokenId], collection.id);
              console.log(`✅ [Owned NFTs] fetchAndStoreNFTMetadata completed for token ${tokenId}`);
              
              // Get the updated NFT from database
              console.log(`🔍 [Owned NFTs] Fetching updated NFT from database...`);
              const { data: updatedNFT } = await supabase
                .from('nfts')
                .select('*')
                .eq('collection_id', collection.id)
                .eq('token_id', tokenId)
                .single();
              
              console.log(`📋 [Owned NFTs] Updated NFT from database:`, updatedNFT);
              
              if (updatedNFT) {
                metadata = updatedNFT.metadata;
                imageUrl = updatedNFT.image_url;
                title = updatedNFT.title || `Token ${tokenId}`;
                console.log(`✅ [Owned NFTs] Successfully fetched metadata for token ${tokenId}:`, {
                  has_metadata: !!metadata,
                  has_image: !!imageUrl,
                  title: title,
                });
              } else {
                console.log(`⚠️ [Owned NFTs] No updated NFT found in database for token ${tokenId}`);
              }
            } catch (error) {
              console.log(`⚠️ [Owned NFTs] Failed to fetch metadata for token ${tokenId}:`, {
                error: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
              });
            }
            
            ownedNFTs.push({
              id: `discovered-${tokenId}`,
              collection_id: collection.id,
              token_id: tokenId,
              title: title,
              description: null,
              image_url: imageUrl,
              thumbnail_url: null,
              metadata: metadata,
              attributes: null,
              media: null,
              owner_address: userAddress,
              last_owner_check_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              balance,
              editionSupply: editionSupplies[tokenId] ?? undefined,
            });
          }
        }
      }

    } else {
      // Unknown token type, try to determine it
      console.log(`🔍 [Owned NFTs] Unknown token type, attempting to determine...`);
      
      // Try ERC-721 first
      try {
        await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: [parseAbiItem('function ownerOf(uint256 tokenId) view returns (address)')],
          functionName: 'ownerOf',
          args: [BigInt(0)],
        });
        
        console.log(`✅ [Owned NFTs] Detected ERC-721, updating collection...`);
        // Update collection token type
        await supabase
          .from('collections')
          .update({ token_type: 'ERC721' })
          .eq('id', collection.id);
        
        // Retry with ERC-721 logic
        return GET(request, { params });
        
      } catch {
        console.log(`⚠️ [Owned NFTs] Not ERC-721, trying ERC-1155...`);
        
        try {
          await publicClient.readContract({
            address: contractAddress as `0x${string}`,
            abi: [parseAbiItem('function balanceOf(address account, uint256 id) view returns (uint256)')],
            functionName: 'balanceOf',
            args: [userAddress as `0x${string}`, BigInt(0)],
          });
          
          console.log(`✅ [Owned NFTs] Detected ERC-1155, updating collection...`);
          // Update collection token type
          await supabase
            .from('collections')
            .update({ token_type: 'ERC1155' })
            .eq('id', collection.id);
          
          // Retry with ERC-1155 logic
          return GET(request, { params });
          
        } catch (erc1155Error) {
          console.error(`❌ [Owned NFTs] Could not determine token type:`, erc1155Error);
          return NextResponse.json(
            { error: 'Could not determine token type' },
            { status: 500 }
          );
        }
      }
    }

    console.log(`✅ [Owned NFTs] Found ${ownedNFTs.length} owned NFTs`);

    // Log detailed information about each owned NFT
    ownedNFTs.forEach((nft, index) => {
      console.log(`📋 [Owned NFTs] NFT ${index + 1}:`, {
        id: nft.id,
        token_id: nft.token_id,
        title: nft.title,
        has_image: !!nft.image_url,
        has_thumbnail: !!nft.thumbnail_url,
        has_metadata: !!nft.metadata,
        has_attributes: !!nft.attributes,
        has_media: !!nft.media,
        balance: nft.balance,
        editionSupply: nft.editionSupply,
        owner_address: nft.owner_address,
        is_discovered: nft.id.startsWith('discovered-'),
        raw_nft: nft,
      });
    });

    // Log the final response structure
    const response = {
      nfts: ownedNFTs,
      total: ownedNFTs.length,
      page,
      pageSize,
      tokenType: collection.token_type,
    };

    console.log(`📤 [Owned NFTs] Sending response:`, {
      nftCount: response.nfts.length,
      total: response.total,
      page: response.page,
      pageSize: response.pageSize,
      tokenType: response.tokenType,
      nfts: response.nfts.map(nft => ({
        id: nft.id,
        token_id: nft.token_id,
        title: nft.title,
        has_image: !!nft.image_url,
        has_thumbnail: !!nft.thumbnail_url,
        has_metadata: !!nft.metadata,
        balance: nft.balance,
        editionSupply: nft.editionSupply,
      })),
    });

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ [Owned NFTs] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 