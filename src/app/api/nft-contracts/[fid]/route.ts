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
  status: 'found' | 'none' | 'error';
  message: string;
  contracts: AlchemyContract[];
  hasMoreCollections: boolean;
  totalCollectionsFound: number;
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fid: string }> }
) {
  try {
    const { fid } = await params;

    console.log(`🔍 [NFT Contracts] Getting NFT contracts for FID: ${fid}`);

    // Step 1: Get Farcaster user profile using Neynar SDK
    const user = await getNeynarUser(parseInt(fid));

    if (!user) {
      console.error('❌ User not found for FID:', fid);
      return NextResponse.json(
        { 
          error: 'User not found',
          message: 'This Farcaster user does not exist or is not accessible',
          fid: parseInt(fid)
        },
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
        status: 'error',
        message: '',
        contracts: [],
        hasMoreCollections: false,
        totalCollectionsFound: 0,
      };

      try {
        // Step 3a: Check cache first
        const cacheKey = CACHE_KEYS.walletContracts(walletAddress);
        let cachedData: CachedNFTData | null = null;
        let cacheSource = 'none';

        if (isRedisConfigured) {
          try {
            cachedData = await getCachedData<CachedNFTData>(cacheKey);
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
          walletData.hasMoreCollections = cachedData.contracts.length >= 1000;
          walletData.totalCollectionsFound = cachedData.contracts.length;
          walletData.message = `Found ${cachedData.contracts.length} NFT collection(s) from ${cacheSource} cache`;
          walletNfts.push(walletData);
          continue;
        }

        // Step 3d: Fetch fresh data from Alchemy
        console.log(`🔄 [NFT Contracts] Fetching fresh data from Alchemy for wallet: ${walletAddress}`);
        
        const alchemyUrl = `https://base-mainnet.g.alchemy.com/nft/v3/${process.env.ALCHEMY_API_KEY}/getContractsForOwner`;
        const params = new URLSearchParams({
          owner: walletAddress,
          pageSize: '1000',
          withMetadata: 'true',
          excludeSpam: 'true',
        });

        const response = await fetch(`${alchemyUrl}?${params}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          console.error(`❌ Alchemy API error for ${walletAddress}: ${response.status}`);
          walletData.status = 'error';
          walletData.message = `Failed to fetch data from Alchemy API (${response.status})`;
          walletNfts.push(walletData);
          continue;
        }

        const data = await response.json();
        const allContracts: AlchemyContract[] = data.contracts || [];
        
        if (allContracts.length > 0) {
          walletData.contracts = allContracts;
          walletData.status = 'found';
          walletData.hasMoreCollections = allContracts.length >= 1000; // If we hit the page limit, there might be more
          walletData.totalCollectionsFound = allContracts.length;
          
          if (walletData.hasMoreCollections) {
            walletData.message = `Found first ${allContracts.length} NFT collection(s)`;
          } else {
            walletData.message = `Found ${allContracts.length} NFT collection(s)`;
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