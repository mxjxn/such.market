import { Alchemy, Network } from 'alchemy-sdk';
import { ethers, JsonRpcProvider } from 'ethers';

// Standard ERC721 metadata ABI
const ERC721_METADATA_ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
];

// Standard ERC1155 metadata ABI - only the function we know works
const ERC1155_METADATA_ABI = [
  'function uri(uint256 tokenId) view returns (string)',
];

// Metadata interface
interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  [key: string]: unknown;
}

// Rate limiting setup
const RATE_LIMIT_MS = 1000; // 1 second between requests
const lastRequestTime = new Map<string, number>();

// Helper to enforce rate limiting
async function rateLimitedRequest<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const lastRequest = lastRequestTime.get(key) || 0;
  const timeToWait = Math.max(0, lastRequest + RATE_LIMIT_MS - now);
  
  if (timeToWait > 0) {
    console.log(`⏳ Rate limiting: waiting ${timeToWait}ms before next request`);
    await new Promise(resolve => setTimeout(resolve, timeToWait));
  }
  
  lastRequestTime.set(key, Date.now());
  return fn();
}

// Initialize Alchemy SDK with proper error handling
let alchemy: Alchemy;
try {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    throw new Error('ALCHEMY_API_KEY is not set');
  }
  alchemy = new Alchemy({
    apiKey,
    network: Network.BASE_MAINNET,
  });
} catch (error) {
  console.error('❌ Failed to initialize Alchemy SDK:', error);
  throw error;
}

// Helper to get provider with retries and rate limiting
async function getProviderWithRetry(): Promise<JsonRpcProvider> {
  return rateLimitedRequest('provider', async () => {
    try {
      // Use direct RPC URL from environment
      const baseRpcUrl = process.env.BASE_MAINNET_RPC;
      if (!baseRpcUrl) {
        throw new Error('BASE_MAINNET_RPC is not set');
      }
      const provider = new JsonRpcProvider(baseRpcUrl);
      
      // Verify provider is working
      await provider.getNetwork();
      return provider;
    } catch (error) {
      console.error('❌ Failed to initialize provider:', error);
      throw error;
    }
  });
}

// Helper to retry a contract call
async function retryContractCall<T>(
  contract: ethers.Contract,
  functionName: string,
  args: any[],
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Add a small delay between retries
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs * i));
      }
      
      console.log(`🔄 Attempt ${i + 1}/${maxRetries} for ${functionName}...`);
      const result = await contract[functionName](...args);
      return result;
    } catch (error) {
      lastError = error as Error;
      console.log(`⚠️ Attempt ${i + 1} failed:`, {
        functionName,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any)?.code,
        reason: (error as any)?.reason,
      });
      
      // If it's not a revert, don't retry
      if ((error as any)?.code !== 'CALL_EXCEPTION') {
        throw error;
      }
    }
  }
  
  throw lastError || new Error(`Failed after ${maxRetries} attempts`);
}

// Helper to determine if a URI is IPFS
function isIPFS(uri: string): boolean {
  return uri.startsWith('ipfs://') || uri.includes('ipfs/');
}

// Helper to convert IPFS URI to HTTP URL
function ipfsToHttp(uri: string): string {
  if (uri.startsWith('ipfs://')) {
    return `https://ipfs.io/ipfs/${uri.replace('ipfs://', '')}`;
  }
  if (uri.includes('ipfs/')) {
    return `https://ipfs.io/${uri.split('ipfs/')[1]}`;
  }
  return uri;
}

// Helper to fetch and parse metadata from URI
async function fetchMetadataFromUri(uri: string): Promise<NFTMetadata | null> {
  try {
    const httpUrl = isIPFS(uri) ? ipfsToHttp(uri) : uri;
    console.log('📡 Fetching metadata from:', httpUrl);
    
    const response = await fetch(httpUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata from ${httpUrl}`);
    }
    
    const metadata = await response.json() as NFTMetadata;
    return metadata;
  } catch (error) {
    console.error('❌ Error fetching metadata from URI:', {
      uri,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

// Main function to get metadata from contract
export async function getOnChainMetadata(
  contractAddress: string,
  tokenId: string,
  tokenType: 'ERC721' | 'ERC1155' = 'ERC721'
): Promise<NFTMetadata | null> {
  return rateLimitedRequest(`metadata-${contractAddress}-${tokenId}`, async () => {
    try {
      const provider = await getProviderWithRetry();
      
      if (tokenType === 'ERC721') {
        const contract = new ethers.Contract(
          contractAddress,
          ERC721_METADATA_ABI,
          provider
        );
        
        try {
          const metadataUri = await retryContractCall<string>(
            contract,
            'tokenURI',
            [tokenId]
          );
          return await fetchMetadataFromUri(metadataUri);
        } catch (error) {
          console.log('⚠️ Failed to get ERC721 metadata:', {
            contractAddress,
            tokenId,
            error: error instanceof Error ? error.message : 'Unknown error',
            code: (error as any)?.code,
            reason: (error as any)?.reason,
          });
          return null;
        }
      } else {
        // For ERC1155, we know uri(uint256) is the only function we need
        try {
          const contract = new ethers.Contract(
            contractAddress,
            ERC1155_METADATA_ABI,
            provider
          );

          console.log('📡 Fetching metadata URI for token:', { contractAddress, tokenId });
          const metadataUri = await contract.uri(tokenId);
          
          if (!metadataUri) {
            console.log('⚠️ No metadata URI returned for token:', { contractAddress, tokenId });
            return null;
          }

          console.log('✅ Got metadata URI:', metadataUri);
          const metadata = await fetchMetadataFromUri(metadataUri);
          
          if (!metadata) {
            console.log('⚠️ Failed to fetch metadata from URI:', { contractAddress, tokenId, metadataUri });
            return null;
          }

          // Handle IPFS images in metadata
          if (metadata.image && isIPFS(metadata.image)) {
            metadata.image = ipfsToHttp(metadata.image);
          }

          return metadata;
        } catch (error) {
          console.error('❌ Error getting ERC1155 metadata:', {
            contractAddress,
            tokenId,
            error: error instanceof Error ? error.message : 'Unknown error',
            code: (error as { code?: string })?.code,
            reason: (error as { reason?: string })?.reason,
          });
          return null;
        }
      }
    } catch (error) {
      console.error('❌ Error getting on-chain metadata:', {
        contractAddress,
        tokenId,
        tokenType,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: (error as { code?: string })?.code,
        reason: (error as { reason?: string })?.reason,
      });
      return null;
    }
  });
}

// Helper to determine token type
export async function getTokenType(contractAddress: string): Promise<'ERC721' | 'ERC1155' | null> {
  try {
    const nft = await alchemy.nft.getNftMetadata(contractAddress, '1');
    return nft.tokenType as 'ERC721' | 'ERC1155';
  } catch (error) {
    console.error('❌ Error determining token type:', {
      contractAddress,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
} 