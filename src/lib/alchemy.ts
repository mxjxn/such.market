import { Alchemy, Network } from 'alchemy-sdk';
import { v4 as uuidv4 } from 'uuid';
import type { Database } from '@/db/types/database.types';

type DatabaseNFTInsert = Omit<Database['public']['Tables']['nfts']['Row'], 'id'> & { id?: string };

// Initialize Alchemy client
let alchemy: Alchemy | null = null;

function getAlchemyClient(): Alchemy | null {
  if (!alchemy && process.env.ALCHEMY_API_KEY) {
    try {
      console.log('🔧 Initializing Alchemy client...');
      alchemy = new Alchemy({
        apiKey: process.env.ALCHEMY_API_KEY,
        network: Network.BASE_MAINNET,
      });
      console.log('✅ Alchemy client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Alchemy client:', error);
    }
  }
  return alchemy;
}

export async function fetchFromAlchemy(contractAddress: string, tokenId: string): Promise<DatabaseNFTInsert | null> {
  const client = getAlchemyClient();
  if (!client) return null;
  
  try {
    console.log(`🔍 [Alchemy] Fetching NFT metadata for ${contractAddress} #${tokenId}`);
    const nft = await client.nft.getNftMetadata(contractAddress, tokenId);
    
    if (nft) {
      console.log(`✅ [Alchemy] Successfully fetched NFT metadata:`, {
        tokenId,
        name: nft.title,
        hasImage: !!nft.media?.[0]?.gateway,
        hasMetadata: !!nft.rawMetadata,
      });
      
      return {
        id: uuidv4(),
        collection_id: '', // Will be set by caller
        token_id: tokenId,
        title: nft.title || `NFT #${tokenId}`,
        description: nft.description || null,
        image_url: nft.media?.[0]?.gateway || null,
        thumbnail_url: nft.media?.[0]?.thumbnail || null,
        metadata: nft.rawMetadata ? JSON.stringify(nft.rawMetadata) : null,
        attributes: nft.rawMetadata?.attributes || null,
        media: nft.media || null,
        owner_address: null,
        last_owner_check_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  } catch (error) {
    console.warn(`⚠️ [Alchemy] Fetch failed for token ${tokenId}:`, error instanceof Error ? error.message : error);
  }
  return null;
} 