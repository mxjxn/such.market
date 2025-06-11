import { NextRequest, NextResponse } from 'next/server';
import { getNeynarUser } from '~/lib/neynar';
import { 
  isRedisConfigured, 
  CACHE_KEYS,
  getCachedData,
  setCachedData
} from '~/lib/redis';
import { getWalletCollections } from '~/lib/db/ownership';

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

    console.log(`🔍 [NFT Contracts Normalized] Getting NFT contracts for FID: ${fid}`);

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

    console.log(`✅ [NFT Contracts Normalized] Found user: ${user.username} (${user.display_name})`);

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
    const verificationMessages: VerificationMessage[] = verificationsData.messages || [];

    // Extract verified Ethereum addresses
    const validEthereumAddresses = verificationMessages
      .map(msg => {
        if (msg.data?.type === 'MESSAGE_TYPE_VERIFICATION_ADD_ETH_ADDRESS') {
          return msg.data.verificationAddEthAddressBody?.address;
        }
        if (msg.data?.type === 'MESSAGE_TYPE_VERIFICATION_ADD_ADDRESS') {
          return msg.data.verificationAddAddressBody?.address;
        }
        return null;
      })
      .filter((address): address is string => 
        address !== null && 
        address !== undefined && 
        /^0x[a-fA-F0-9]{40}$/.test(address)
      );

    // Add custody address if it's a valid Ethereum address
    if (user.custody_address && /^0x[a-fA-F0-9]{40}$/.test(user.custody_address)) {
      validEthereumAddresses.unshift(user.custody_address);
    }

    if (validEthereumAddresses.length === 0) {
      console.log('ℹ️ No valid Ethereum addresses found for user');
      return NextResponse.json({
        user: {
          fid: parseInt(fid),
          username: user.username,
          display_name: user.display_name,
          pfp_url: user.pfp_url,
        },
        wallets: [],
        totalCollections: 0,
        successfulWallets: 0,
        message: 'No verified Ethereum addresses found for this user',
      });
    }

    console.log(`🔍 [NFT Contracts Normalized] Processing ${validEthereumAddresses.length} wallet(s)`);

    // Step 3: Process each wallet address
    const walletNfts: WalletNFTData[] = [];

    for (let i = 0; i < validEthereumAddresses.length; i++) {
      const walletAddress = validEthereumAddresses[i];
      console.log(`🔍 [NFT Contracts Normalized] Processing wallet ${i + 1}/${validEthereumAddresses.length}: ${walletAddress}`);

      const walletData: WalletNFTData = {
        walletAddress,
        status: 'error',
        message: '',
        contracts: [],
        hasMoreCollections: false,
        totalCollectionsFound: 0,
      };

      try {
        // Step 3a: Check Redis cache first
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

        // Step 3b: If no Redis cache, try normalized database
        if (!cachedData) {
          console.log(`🔄 [NFT Contracts Normalized] Checking normalized database for wallet: ${walletAddress}`);
          
          const walletCollections = await getWalletCollections(walletAddress);
          
          if (walletCollections.length > 0) {
            // Convert normalized data to AlchemyContract format
            const contracts: AlchemyContract[] = walletCollections.map(mapping => ({
              address: mapping.collection_address,
              totalBalance: mapping.token_count,
              numDistinctTokensOwned: mapping.token_count,
              isSpam: false, // We don't track spam in normalized system
              name: undefined, // Would need to join with collections table
              symbol: undefined,
              tokenType: 'ERC721', // Default assumption
            }));

            cachedData = {
              contracts,
              cachedAt: new Date(walletCollections[0]?.last_owned_at || Date.now()).getTime(),
              walletAddress
            };
            cacheSource = 'normalized_db';
            console.log(`✅ Found normalized database data for wallet: ${walletAddress}`);
          }
        }

        // Step 3c: If we have cached data, use it
        if (cachedData) {
          walletData.contracts = cachedData.contracts;
          walletData.status = 'found';
          walletData.hasMoreCollections = cachedData.contracts.length >= 1000;
          walletData.totalCollectionsFound = cachedData.contracts.length;
          walletData.message = `Found ${cachedData.contracts.length} NFT collection(s) from ${cacheSource}`;
          walletNfts.push(walletData);
          continue;
        }

        // Step 3d: Fetch fresh data from Alchemy
        console.log(`🔄 [NFT Contracts Normalized] Fetching fresh data from Alchemy for wallet: ${walletAddress}`);
        
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
          walletData.hasMoreCollections = allContracts.length >= 1000;
          walletData.totalCollectionsFound = allContracts.length;
          
          if (walletData.hasMoreCollections) {
            walletData.message = `Found first ${allContracts.length} NFT collection(s)`;
          } else {
            walletData.message = `Found ${allContracts.length} NFT collection(s)`;
          }
          
          // Cache the results in Redis only (no more user_nft_cache)
          const cacheData: CachedNFTData = {
            contracts: allContracts,
            cachedAt: Date.now(),
            walletAddress
          };
          
          if (isRedisConfigured) {
            try {
              console.log(`💾 Caching NFT data in Redis for wallet: ${walletAddress}`);
              await setCachedData(cacheKey, cacheData, CACHE_TTL_HOURS * 3600);
            } catch (redisError) {
              console.warn(`⚠️ Failed to cache data in Redis for ${walletAddress}:`, redisError);
            }
          }
          
        } else {
          walletData.status = 'none';
          walletData.message = `No NFTs discovered for ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
          walletData.totalCollectionsFound = 0;
          
          // Cache empty result in Redis only
          const cacheData: CachedNFTData = {
            contracts: [],
            cachedAt: Date.now(),
            walletAddress
          };
          
          if (isRedisConfigured) {
            try {
              console.log(`💾 Caching empty result in Redis for wallet: ${walletAddress}`);
              await setCachedData(cacheKey, cacheData, CACHE_TTL_HOURS * 3600);
            } catch (redisError) {
              console.warn(`⚠️ Failed to cache empty result in Redis for ${walletAddress}:`, redisError);
            }
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

    console.log(`✅ [NFT Contracts Normalized] Completed processing ${validEthereumAddresses.length} wallets`);
    console.log(`📊 [NFT Contracts Normalized] Summary: ${successfulWallets} successful, ${totalCollections} total collections found`);

    return NextResponse.json({
      user: {
        fid: parseInt(fid),
        username: user.username,
        display_name: user.display_name,
        pfp_url: user.pfp_url,
      },
      wallets: walletNfts,
      totalCollections,
      successfulWallets,
      message: `Found ${totalCollections} NFT collections across ${successfulWallets} wallets`,
      system: 'normalized',
    });
  } catch (error) {
    console.error('❌ [NFT Contracts Normalized] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch NFT contracts',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 