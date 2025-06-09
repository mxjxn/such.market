import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Check if Redis is configured
const isRedisConfigured = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

interface AlchemyContract {
  address: string;
  totalBalance: number;
  numDistinctTokensOwned: number;
  isSpam: boolean;
}

interface AlchemyResponse {
  contracts: AlchemyContract[];
  pageKey?: string;
  totalCount: string;
}

interface ContractMetadata {
  name?: string;
}

interface VerifiedAddress {
  address: string;
  protocol: string;
  chainId?: number;
  timestamp?: number;
  hash?: string;
}

interface CachedNFTData {
  contracts: {
    address: string;
    totalBalance: number;
    numDistinctTokensOwned: number;
    isSpam: boolean;
    name?: string;
  }[];
  cachedAt: number;
  walletAddress: string;
}

interface WalletNFTs {
  walletAddress: string;
  contracts: {
    address: string;
    totalBalance: number;
    numDistinctTokensOwned: number;
    isSpam: boolean;
    name?: string;
  }[];
  status: 'checking' | 'found' | 'none' | 'error';
  message?: string;
  hasMoreCollections?: boolean;
  totalCollectionsFound?: number;
}

const CACHE_TTL_HOURS = 16;
const CACHE_TTL_MS = CACHE_TTL_HOURS * 60 * 60 * 1000;
const MAX_PAGES = 10;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fid: string }> }
) {
  const startTime = Date.now();
  console.log(`🚀 Starting NFT lookup for FID: ${params}`);
  
  try {
    const { fid } = await params;
    console.log(`📋 Processing FID: ${fid}`);
    
    if (!fid) {
      console.error('❌ FID is required');
      return NextResponse.json(
        { error: 'FID is required' },
        { status: 400 }
      );
    }

    // Get the user's wallet addresses from FID using verifications API
    console.log(`🔍 Fetching verified wallet addresses for FID: ${fid}`);
    const walletAddresses = await getWalletAddressesFromFid(fid);
    
    if (!walletAddresses || walletAddresses.length === 0) {
      console.log(`⚠️ No verified wallet addresses found for FID: ${fid}`);
      return NextResponse.json(
        { 
          error: 'No verified wallet addresses found for this FID',
          wallets: [],
          totalWallets: 0,
          totalCollections: 0,
          processingTime: Date.now() - startTime
        },
        { status: 404 }
      );
    }

    console.log(`✅ Found ${walletAddresses.length} verified wallet(s) for FID: ${fid}`);

    // Check Alchemy API key
    const alchemyApiKey = process.env.ALCHEMY_API_KEY;
    if (!alchemyApiKey) {
      console.error('❌ Alchemy API key not configured');
      return NextResponse.json(
        { error: 'Alchemy API key not configured' },
        { status: 500 }
      );
    }

    // Process wallets sequentially with caching
    const walletNfts: WalletNFTs[] = [];
    
    for (let i = 0; i < walletAddresses.length; i++) {
      const walletAddress = walletAddresses[i];
      const walletIndex = i + 1;
      
      console.log(`\n🔍 [${walletIndex}/${walletAddresses.length}] Checking wallet: ${walletAddress}`);
      
      // Initialize wallet status
      const walletData: WalletNFTs = {
        walletAddress,
        contracts: [],
        status: 'checking',
        message: `Looking up NFTs for ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
      };
      
      try {
        // Check Redis cache first
        const cacheKey = `user:${fid}:${walletAddress}:nfts`;
        console.log(`🔍 Checking Redis cache for key: ${cacheKey}`);
        
        let cachedData: CachedNFTData | null = null;
        
        if (isRedisConfigured) {
          try {
            cachedData = await redis.get<CachedNFTData>(cacheKey);
          } catch (redisError) {
            console.warn(`⚠️ Redis cache error for ${cacheKey}:`, redisError);
          }
        } else {
          console.log(`⚠️ Redis not configured, skipping cache check for ${cacheKey}`);
        }
        
        if (cachedData && isCacheValid(cachedData.cachedAt)) {
          console.log(`✅ Found valid cached data for wallet: ${walletAddress}`);
          walletData.contracts = cachedData.contracts;
          walletData.status = cachedData.contracts.length > 0 ? 'found' : 'none';
          walletData.hasMoreCollections = cachedData.contracts.length >= 1000;
          walletData.totalCollectionsFound = cachedData.contracts.length;
          
          if (cachedData.contracts.length > 0) {
            if (walletData.hasMoreCollections) {
              walletData.message = `Found first ${cachedData.contracts.length} NFT collection(s) (cached)`;
            } else {
              walletData.message = `Found ${cachedData.contracts.length} NFT collection(s) (cached)`;
            }
          } else {
            walletData.message = `No NFTs discovered for ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} (cached)`;
          }
          walletNfts.push(walletData);
          continue;
        }
        
        console.log(`🔄 Cache miss or expired, fetching fresh data for wallet: ${walletAddress}`);
        
        // Fetch fresh data from Alchemy with pagination
        const allContracts = await fetchAllNFTContracts(walletAddress, alchemyApiKey);
        
        console.log(`✅ Wallet ${walletAddress}: ${allContracts.length} total contracts found`);
        
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
          
          if (isRedisConfigured) {
            try {
              console.log(`💾 Caching NFT data for wallet: ${walletAddress}`);
              await redis.setex(cacheKey, CACHE_TTL_HOURS * 3600, cacheData);
            } catch (redisError) {
              console.warn(`⚠️ Failed to cache data for ${walletAddress}:`, redisError);
            }
          } else {
            console.log(`⚠️ Redis not configured, skipping cache for ${walletAddress}`);
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
          
          if (isRedisConfigured) {
            try {
              console.log(`💾 Caching empty result for wallet: ${walletAddress}`);
              await redis.setex(cacheKey, CACHE_TTL_HOURS * 3600, cacheData);
            } catch (redisError) {
              console.warn(`⚠️ Failed to cache empty result for ${walletAddress}:`, redisError);
            }
          } else {
            console.log(`⚠️ Redis not configured, skipping cache for ${walletAddress}`);
          }
        }
        
        walletNfts.push(walletData);
        
      } catch (error) {
        console.error(`❌ Error processing wallet ${walletAddress}:`, error);
        walletData.status = 'error';
        walletData.message = `Error checking ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
        walletNfts.push(walletData);
      }
    }

    const processingTime = Date.now() - startTime;
    const totalCollections = walletNfts.reduce((sum, wallet) => sum + wallet.contracts.length, 0);
    
    console.log(`\n🎉 NFT lookup completed for FID: ${fid}`);
    console.log(`📈 Results: ${walletNfts.length} wallets processed, ${totalCollections} total collections`);
    console.log(`⏱️ Processing time: ${processingTime}ms`);

    return NextResponse.json({
      wallets: walletNfts,
      totalWallets: walletNfts.length,
      totalCollections,
      processingTime,
      status: 'completed'
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Error in NFT contracts API:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        processingTime,
        status: 'error'
      },
      { status: 500 }
    );
  }
}

// Check if cache is still valid (less than 16 hours old)
function isCacheValid(cachedAt: number): boolean {
  const now = Date.now();
  const age = now - cachedAt;
  return age < CACHE_TTL_MS;
}

// Fetch all NFT contracts with pagination support
async function fetchAllNFTContracts(walletAddress: string, alchemyApiKey: string) {
  const allContracts: {
    address: string;
    totalBalance: number;
    numDistinctTokensOwned: number;
    isSpam: boolean;
    name?: string;
  }[] = [];
  let pageKey: string | undefined;
  let pageCount = 0;
  
  console.log(`📡 Starting paginated fetch for wallet: ${walletAddress}`);
  
  do {
    pageCount++;
    console.log(`📄 Fetching page ${pageCount} for wallet: ${walletAddress}`);
    
    const alchemyUrl = `https://base-mainnet.g.alchemy.com/nft/v3/${alchemyApiKey}/getContractsForOwner`;
    const url = new URL(alchemyUrl);
    url.searchParams.append('owner', walletAddress);
    url.searchParams.append('pageSize', '100');
    url.searchParams.append('withMetadata', 'false');
    url.searchParams.append('excludeFilters[]', 'SPAM');
    
    if (pageKey) {
      url.searchParams.append('pageKey', pageKey);
    }

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.error(`❌ Alchemy API error on page ${pageCount}:`, response.status);
      break;
    }

    const data: AlchemyResponse = await response.json();
    console.log(`📊 Page ${pageCount}: Alchemy returned ${data.contracts.length} contracts`);
    
    // Transform contracts to include collection names
    const contractsWithMetadata = await Promise.all(
      data.contracts.map(async (contract: AlchemyContract, contractIndex: number) => {
        console.log(`🏷️ [${contractIndex + 1}/${data.contracts.length}] Fetching metadata for contract: ${contract.address}`);
        
        // Try to get collection metadata
        let name = `Collection ${contract.address.slice(0, 6)}...`;
        
        try {
          const metadataUrl = `https://base-mainnet.g.alchemy.com/nft/v3/${alchemyApiKey}/getContractMetadata`;
          const metadataResponse = await fetch(`${metadataUrl}?contractAddress=${contract.address}`);
          
          if (metadataResponse.ok) {
            const metadata: ContractMetadata = await metadataResponse.json();
            if (metadata.name) {
              name = metadata.name;
              console.log(`✅ Found name for ${contract.address}: ${name}`);
            }
          }
        } catch (error) {
          console.error(`❌ Error fetching contract metadata for ${contract.address}:`, error);
        }

        return {
          address: contract.address,
          totalBalance: contract.totalBalance,
          numDistinctTokensOwned: contract.numDistinctTokensOwned,
          isSpam: contract.isSpam,
          name
        };
      })
    );

    // Filter valid contracts and add to collection
    const validContracts = contractsWithMetadata.filter(contract => 
      !contract.isSpam && contract.totalBalance > 0
    );
    
    allContracts.push(...validContracts);
    console.log(`✅ Page ${pageCount}: Added ${validContracts.length} valid contracts`);
    
    // Update pageKey for next iteration
    pageKey = data.pageKey;
    
    // Break if we've reached the maximum number of pages
    if (pageCount >= MAX_PAGES) {
      console.log(`⚠️ Reached maximum page limit (${MAX_PAGES}) for wallet: ${walletAddress}`);
      break;
    }
    
  } while (pageKey);
  
  console.log(`🎯 Total contracts found for ${walletAddress}: ${allContracts.length} across ${pageCount} pages`);
  return allContracts;
}

// Get wallet addresses from FID using the verifications API
async function getWalletAddressesFromFid(fid: string): Promise<string[]> {
  try {
    console.log(`🔗 Fetching verifications for FID: ${fid}`);
    const response = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/verifications/${fid}`);
    
    if (!response.ok) {
      console.error('❌ Failed to fetch verifications:', response.status);
      return [];
    }

    const data = await response.json();
    const verifiedAddresses: VerifiedAddress[] = data.verifiedAddresses || [];
    
    console.log(`✅ Found ${verifiedAddresses.length} verified addresses for FID: ${fid}`);
    
    // Return only Ethereum addresses (you might want to filter by chainId for Base)
    const ethereumAddresses = verifiedAddresses
      .filter(addr => addr.protocol === 'PROTOCOL_ETHEREUM' || addr.protocol === 'PROTOCOL_ETH')
      .map(addr => addr.address);
    
    console.log(`🔐 Filtered to ${ethereumAddresses.length} Ethereum addresses`);
    return ethereumAddresses;
      
  } catch (error) {
    console.error('❌ Error getting wallet addresses from FID:', error);
    return [];
  }
} 