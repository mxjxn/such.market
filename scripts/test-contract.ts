import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { base } from 'viem/chains';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
console.log('Loading env from:', envPath);
dotenv.config({ path: envPath });

const CONTRACT_ADDRESS = '0x528fd133d6fb004faccc08b70e04186299eba176';
const TOKEN_ID = '1';

// Separate ABIs to avoid ambiguity
const ERC1155_URI_WITH_ID_ABI = [
  parseAbiItem('function uri(uint256 tokenId) view returns (string)'),
] as const;

const ERC1155_URI_BASE_ABI = [
  parseAbiItem('function uri() view returns (string)'),
] as const;

const ERC1155_TOKEN_URI_ABI = [
  parseAbiItem('function tokenURI(uint256 tokenId) view returns (string)'),
] as const;

async function testContract() {
  console.log('🔍 Testing contract calls...');
  console.log('Environment:', {
    envPath,
    alchemyKey: process.env.ALCHEMY_API_KEY ? '***' + process.env.ALCHEMY_API_KEY.slice(-4) : 'not set',
    baseRpc: process.env.BASE_MAINNET_RPC ? '***' + process.env.BASE_MAINNET_RPC.slice(-4) : 'not set',
  });

  // Try Alchemy RPC first
  if (process.env.ALCHEMY_API_KEY) {
    try {
      console.log('\n📡 Testing Alchemy RPC...');
      const alchemyUrl = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
      const client = createPublicClient({
        chain: base,
        transport: http(alchemyUrl),
      });
      
      // Test basic RPC connection
      const network = await client.getChainId();
      console.log('Network:', network);
      
      // Test each ABI separately
      console.log('\nTesting uri(uint256)...');
      try {
        const uri = await client.readContract({
          address: CONTRACT_ADDRESS as Address,
          abi: ERC1155_URI_WITH_ID_ABI,
          functionName: 'uri',
          args: [BigInt(TOKEN_ID)],
        });
        console.log('URI with ID:', uri);
      } catch (error) {
        console.log('uri(uint256) failed:', error instanceof Error ? error.message : 'Unknown error');
      }

      console.log('\nTesting uri()...');
      try {
        const baseUri = await client.readContract({
          address: CONTRACT_ADDRESS as Address,
          abi: ERC1155_URI_BASE_ABI,
          functionName: 'uri',
          args: [],
        });
        console.log('Base URI:', baseUri);
        if (baseUri) {
          const fullUri = baseUri.replace('{id}', TOKEN_ID);
          console.log('Full URI with ID:', fullUri);
        }
      } catch (error) {
        console.log('uri() failed:', error instanceof Error ? error.message : 'Unknown error');
      }

      console.log('\nTesting tokenURI(uint256)...');
      try {
        const tokenUri = await client.readContract({
          address: CONTRACT_ADDRESS as Address,
          abi: ERC1155_TOKEN_URI_ABI,
          functionName: 'tokenURI',
          args: [BigInt(TOKEN_ID)],
        });
        console.log('Token URI:', tokenUri);
      } catch (error) {
        console.log('tokenURI(uint256) failed:', error instanceof Error ? error.message : 'Unknown error');
      }
      
    } catch (error) {
      console.error('❌ Alchemy RPC test failed:', error);
    }
  } else {
    console.log('\n⚠️ Skipping Alchemy RPC test - API key not set');
  }

  // Try Base RPC
  if (process.env.BASE_MAINNET_RPC) {
    try {
      console.log('\n📡 Testing Base RPC...');
      const client = createPublicClient({
        chain: base,
        transport: http(process.env.BASE_MAINNET_RPC),
      });
      
      // Test basic RPC connection
      const network = await client.getChainId();
      console.log('Network:', network);
      
      // Test each ABI separately
      console.log('\nTesting uri(uint256)...');
      try {
        const uri = await client.readContract({
          address: CONTRACT_ADDRESS as Address,
          abi: ERC1155_URI_WITH_ID_ABI,
          functionName: 'uri',
          args: [BigInt(TOKEN_ID)],
        });
        console.log('URI with ID:', uri);
      } catch (error) {
        console.log('uri(uint256) failed:', error instanceof Error ? error.message : 'Unknown error');
      }

      console.log('\nTesting uri()...');
      try {
        const baseUri = await client.readContract({
          address: CONTRACT_ADDRESS as Address,
          abi: ERC1155_URI_BASE_ABI,
          functionName: 'uri',
          args: [],
        });
        console.log('Base URI:', baseUri);
        if (baseUri) {
          const fullUri = baseUri.replace('{id}', TOKEN_ID);
          console.log('Full URI with ID:', fullUri);
        }
      } catch (error) {
        console.log('uri() failed:', error instanceof Error ? error.message : 'Unknown error');
      }

      console.log('\nTesting tokenURI(uint256)...');
      try {
        const tokenUri = await client.readContract({
          address: CONTRACT_ADDRESS as Address,
          abi: ERC1155_TOKEN_URI_ABI,
          functionName: 'tokenURI',
          args: [BigInt(TOKEN_ID)],
        });
        console.log('Token URI:', tokenUri);
      } catch (error) {
        console.log('tokenURI(uint256) failed:', error instanceof Error ? error.message : 'Unknown error');
      }
      
    } catch (error) {
      console.error('❌ Base RPC test failed:', error);
    }
  } else {
    console.log('\n⚠️ Skipping Base RPC test - RPC URL not set');
  }
}

// Run the test
testContract().catch(console.error); 