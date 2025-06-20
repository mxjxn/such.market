import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '~/lib/supabase';
import { getNeynarUser } from '~/lib/neynar';
import { 
  isRedisConfigured, 
  CACHE_KEYS,
  getCachedData,
  setCachedData
} from '~/lib/redis';

interface AlchemyContract {
  address: string;
  totalBalance: number;
  numDistinctTokensOwned: number;
  isSpam: boolean;
  name?: string;
  symbol?: string;
  tokenType?: string;
}

interface CachedNFTData {
  contracts: AlchemyContract[];
  cachedAt: number;
  walletAddress: string;
}

interface WalletNFTData {
  walletAddress: string;
  status: 'found' | 'none' | 'error' | 'checking';
  message: string;
  contracts: AlchemyContract[];
  hasMoreCollections: boolean;
  totalCollectionsFound: number;
  pageKey?: string; // Add pageKey for pagination
}

interface VerificationMessage {
  data?: {
    type?: string;
    verificationAddEthAddressBody?: {
      address?: string;
    };
    verificationAddAddressBody?: {
      address?: string;
    };
  };
}

// Cache TTL - 24 hours in seconds
const CACHE_TTL_HOURS = 24;

// Helper function to fetch all contracts with pagination
async function fetchAllContractsForOwner(walletAddress: string): Promise<{
  contracts: AlchemyContract[];
  hasMore: boolean;
  pageKey?: string;
}> {
  const allContracts: AlchemyContract[] = [];
  let pageKey: string | undefined;
  let hasMore = true;
  let pageCount = 0;
  const maxPages = 10; // Safety limit to prevent infinite loops

  while (hasMore && pageCount < maxPages) {
    pageCount++;
    console.log(`🔄 [NFT Contracts] Fetching page ${pageCount} for wallet: ${walletAddress}`);
    
    const alchemyUrl = `https://base-mainnet.g.alchemy.com/nft/v3/${process.env.ALCHEMY_API_KEY}/getContractsForOwner`;
    const params = new URLSearchParams({
      owner: walletAddress,
      pageSize: '1000',
      withMetadata: 'true',
      excludeSpam: 'true',
    });

    if (pageKey) {
      params.append('pageKey', pageKey);
    }

    const response = await fetch(`${alchemyUrl}?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`❌ Alchemy API error for ${walletAddress} on page ${pageCount}: ${response.status}`);
      throw new Error(`Alchemy API error: ${response.status}`);
    }

    const data = await response.json();
    const contracts: AlchemyContract[] = data.contracts || [];
    
    allContracts.push(...contracts);
    
    // Check if there are more pages
    hasMore = !!data.pageKey && contracts.length === 1000;
    pageKey = data.pageKey;
    
    console.log(`📊 [NFT Contracts] Page ${pageCount} results: ${contracts.length} contracts, hasMore: ${hasMore}`);
    
    // Add a small delay to avoid rate limiting
    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`✅ [NFT Contracts] Completed fetching all contracts for ${walletAddress}: ${allContracts.length} total contracts across ${pageCount} pages`);
  
  return {
    contracts: allContracts,
    hasMore: !!pageKey,
    pageKey
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fid: string }> }
) {
  try {
    const { fid } = await params;
    const { searchParams } = new URL(request.url);
    const pageKey = searchParams.get('pageKey'); // Support for pagination
    const walletAddress = searchParams.get('walletAddress'); // Support for specific wallet pagination

    console.log(`🔍 [NFT Contracts] Request for FID ${fid}${pageKey ? ` with pageKey: ${pageKey}` : ''}${walletAddress ? ` for wallet: ${walletAddress}` : ''}`);

    // If we have a specific wallet and pageKey, handle pagination for that wallet
    if (walletAddress && pageKey) {
      console.log(`🔄 [NFT Contracts] Loading more collections for wallet: ${walletAddress} with pageKey: ${pageKey}`);
      
      try {
        const alchemyUrl = `https://base-mainnet.g.alchemy.com/nft/v3/${process.env.ALCHEMY_API_KEY}/getContractsForOwner`;
        const params = new URLSearchParams({
          owner: walletAddress,
          pageSize: '1000',
          withMetadata: 'true',
          excludeSpam: 'true',
          pageKey: pageKey,
        });

        const response = await fetch(`${alchemyUrl}?${params}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          console.error(`❌ Alchemy API error for ${walletAddress} with pageKey ${pageKey}: ${response.status}`);
          return NextResponse.json(
            { error: 'Failed to fetch additional collections' },
            { status: 500 }
          );
        }

        const data = await response.json();
        const contracts: AlchemyContract[] = data.contracts || [];
        
        console.log(`✅ [NFT Contracts] Loaded ${contracts.length} additional collections for ${walletAddress}`);
        
        return NextResponse.json({
          wallets: [{
            walletAddress,
            status: 'found' as const,
            contracts,
            hasMoreCollections: !!data.pageKey,
            totalCollectionsFound: contracts.length,
            pageKey: data.pageKey,
            message: `Loaded ${contracts.length} additional collections${data.pageKey ? ' (more available)' : ' (complete)'}`
          }]
        });
      } catch (error) {
        console.error(`❌ Error loading more collections for ${walletAddress}:`, error);
        return NextResponse.json(
          { error: 'Failed to load more collections' },
          { status: 500 }
        );
      }
    }

    // Step 1: Get user data from Neynar
    const user = await getNeynarUser(parseInt(fid));
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log(`✅ [NFT Contracts] Found user: ${user.username} (${user.display_name})`);

    // Step 2: Get verified wallet addresses
    const verificationsResponse = await fetch(
      `https://hub-api.neynar.com/v1/verificationsByFid?fid=${fid}`,
      {
        headers: {
          'x-api-key': process.env.NEYNAR_API_KEY!,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!verificationsResponse.ok) {
      console.error('❌ Error fetching verifications:', verificationsResponse.status);
      return NextResponse.json(
        { error: 'Failed to fetch verifications' },
        { status: 500 }
      );
    }

    const verificationsData = await verificationsResponse.json();
    
    // Extract verified addresses from the response (same logic as verifications API)
    const walletAddresses = verificationsData.messages
      ?.filter((message: VerificationMessage) => 
        message.data?.type === 'MESSAGE_TYPE_VERIFICATION_ADD_ETH_ADDRESS' ||
        message.data?.type === 'MESSAGE_TYPE_VERIFICATION_ADD_ADDRESS'
      )
      ?.map((message: VerificationMessage): string | null => {
        const verificationData = message.data?.verificationAddEthAddressBody || 
                                message.data?.verificationAddAddressBody;
        
        if (!verificationData?.address) return null;
        
        return verificationData.address.toLowerCase();
      })
      ?.filter((address: string | null): address is string => address !== null) || [];

    // Filter out non-Ethereum addresses (should be 42 characters starting with 0x)
    const validEthereumAddresses = walletAddresses.filter((address: string) => 
      address.startsWith('0x') && address.length === 42
    );

    console.log(`✅ [NFT Contracts] Found ${validEthereumAddresses.length} valid Ethereum addresses out of ${walletAddresses.length} total addresses`);

    if (validEthereumAddresses.length === 0) {
      return NextResponse.json({
        user: {
          fid: parseInt(fid),
          username: user.username,
          display_name: user.display_name,
          pfp_url: user.pfp_url,
        },
        wallets: [],
        totalWallets: 0,
        message: 'No valid Ethereum addresses found',
      });
    }

    // Step 3: Get NFT contracts for each wallet
    const walletNfts: WalletNFTData[] = [];

    for (let i = 0; i < validEthereumAddresses.length; i++) {
      const walletAddress = validEthereumAddresses[i];
      console.log(`🔍 [NFT Contracts] Processing wallet ${i + 1}/${validEthereumAddresses.length}: ${walletAddress}`);

      const walletData: WalletNFTData = {
        walletAddress,
        status: 'checking',
        message: 'Checking for NFTs...',
        contracts: [],
        hasMoreCollections: false,
        totalCollectionsFound: 0,
      };

      try {
        // Generate cache key
        const cacheKey = CACHE_KEYS.walletContracts(walletAddress);
        let cachedData: CachedNFTData | null = null;
        let cacheSource = '';

        // Step 3a: Try Redis cache first
        if (isRedisConfigured) {
          try {
            cachedData = await getCachedData(cacheKey);
            if (cachedData) {
              cacheSource = 'redis';
              console.log(`✅ Found Redis cached data for wallet: ${walletAddress}`);
            }
          } catch (redisError) {
            console.warn(`⚠️ Redis cache error for ${cacheKey}:`, redisError);
          }
        }

        // Step 3b: If no Redis cache, try Supabase cache
        if (!cachedData) {
          const supabase = getSupabaseClient();
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          
          const { data: supabaseCache, error: supabaseError } = await supabase
            .from('user_nft_cache')
            .select('*')
            .eq('cache_key', cacheKey)
            .gte('created_at', twentyFourHoursAgo)
            .limit(1);
          
          if (supabaseCache && supabaseCache.length > 0 && !supabaseError) {
            const cacheRow = supabaseCache[0];
            cachedData = {
              contracts: cacheRow.contracts || [],
              cachedAt: new Date(cacheRow.created_at).getTime(),
              walletAddress: cacheRow.wallet_address
            };
            cacheSource = 'supabase';
            console.log(`✅ Found Supabase cached data for wallet: ${walletAddress}`);
          } else if (supabaseError) {
            console.warn(`⚠️ Supabase cache error for ${cacheKey}:`, supabaseError);
          }
        }

        // Step 3c: If we have cached data, use it
        if (cachedData) {
          walletData.contracts = cachedData.contracts;
          walletData.status = 'found';
          walletData.hasMoreCollections = false; // Cached data is complete
          walletData.totalCollectionsFound = cachedData.contracts.length;
          walletData.message = `Found ${cachedData.contracts.length} NFT collection(s) from ${cacheSource} cache`;
          walletNfts.push(walletData);
          continue;
        }

        // Step 3d: Fetch fresh data from Alchemy with pagination
        console.log(`🔄 [NFT Contracts] Fetching fresh data from Alchemy for wallet: ${walletAddress}`);
        
        try {
          const { contracts: allContracts, hasMore, pageKey: nextPageKey } = await fetchAllContractsForOwner(walletAddress);
          
          if (allContracts.length > 0) {
            walletData.contracts = allContracts;
            walletData.status = 'found';
            walletData.hasMoreCollections = hasMore;
            walletData.totalCollectionsFound = allContracts.length;
            walletData.pageKey = nextPageKey;
            
            if (hasMore) {
              walletData.message = `Found ${allContracts.length} NFT collection(s) (more available)`;
            } else {
              walletData.message = `Found ${allContracts.length} NFT collection(s) (complete)`;
            }
            
            // Cache the results
            const cacheData: CachedNFTData = {
              contracts: allContracts,
              cachedAt: Date.now(),
              walletAddress
            };
            
            // Try to cache in Redis first
            if (isRedisConfigured) {
              try {
                console.log(`💾 Caching NFT data in Redis for wallet: ${walletAddress}`);
                await setCachedData(cacheKey, cacheData, CACHE_TTL_HOURS * 3600);
              } catch (redisError) {
                console.warn(`⚠️ Failed to cache data in Redis for ${walletAddress}:`, redisError);
              }
            }
            
            // Always cache in Supabase as fallback
            try {
              console.log(`💾 Caching NFT data in Supabase for wallet: ${walletAddress}`);
              const supabase = getSupabaseClient();
              const now = new Date().toISOString();
              
              await supabase
                .from('user_nft_cache')
                .upsert({
                  cache_key: cacheKey,
                  wallet_address: walletAddress,
                  contracts: cacheData.contracts,
                  created_at: now,
                  updated_at: now
                }, {
                  onConflict: 'cache_key',
                  ignoreDuplicates: false
                });
            } catch (supabaseError) {
              console.warn(`⚠️ Failed to cache data in Supabase for ${walletAddress}:`, supabaseError);
            }
            
          } else {
            walletData.status = 'none';
            walletData.message = `No NFTs discovered for ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
            walletData.totalCollectionsFound = 0;
            
            // Cache empty result to avoid repeated API calls
            const cacheData: CachedNFTData = {
              contracts: [],
              cachedAt: Date.now(),
              walletAddress
            };
            
            // Try to cache in Redis first
            if (isRedisConfigured) {
              try {
                console.log(`💾 Caching empty result in Redis for wallet: ${walletAddress}`);
                await setCachedData(cacheKey, cacheData, CACHE_TTL_HOURS * 3600);
              } catch (redisError) {
                console.warn(`⚠️ Failed to cache empty result in Redis for ${walletAddress}:`, redisError);
              }
            }
            
            // Always cache in Supabase as fallback
            try {
              console.log(`💾 Caching empty result in Supabase for wallet: ${walletAddress}`);
              const supabase = getSupabaseClient();
              const now = new Date().toISOString();
              
              await supabase
                .from('user_nft_cache')
                .upsert({
                  cache_key: cacheKey,
                  wallet_address: walletAddress,
                  contracts: [],
                  created_at: now,
                  updated_at: now
                }, {
                  onConflict: 'cache_key',
                  ignoreDuplicates: false
                });
            } catch (supabaseError) {
              console.warn(`⚠️ Failed to cache empty result in Supabase for ${walletAddress}:`, supabaseError);
            }
          }
          
        } catch (error) {
          console.error(`❌ Error fetching contracts for ${walletAddress}:`, error);
          walletData.status = 'error';
          walletData.message = `Failed to fetch data: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
        
        walletNfts.push(walletData);
        
      } catch (error) {
        console.error(`❌ Error processing wallet ${walletAddress}:`, error);
        walletData.status = 'error';
        walletData.message = `Error processing wallet: ${error instanceof Error ? error.message : 'Unknown error'}`;
        walletNfts.push(walletData);
      }
    }

    // Step 4: Return results
    const totalCollections = walletNfts.reduce((sum, wallet) => sum + wallet.totalCollectionsFound, 0);
    const successfulWallets = walletNfts.filter(w => w.status === 'found').length;

    console.log(`✅ [NFT Contracts] Completed processing ${validEthereumAddresses.length} wallets`);
    console.log(`📊 [NFT Contracts] Summary: ${successfulWallets} successful, ${totalCollections} total collections found`);

    return NextResponse.json({
      user: {
        fid: parseInt(fid),
        username: user.username,
        display_name: user.display_name,
        pfp_url: user.pfp_url,
      },
      wallets: walletNfts,
      totalWallets: validEthereumAddresses.length,
      successfulWallets,
      totalCollections,
      message: `Found ${totalCollections} NFT collections across ${successfulWallets} wallets`,
    });

  } catch (error) {
    console.error('❌ Error in NFT contracts endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 