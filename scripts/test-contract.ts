import { ethers } from 'ethers';
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
  'function uri(uint256 tokenId) view returns (string)',
];

const ERC1155_URI_BASE_ABI = [
  'function uri() view returns (string)',
];

const ERC1155_TOKEN_URI_ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
];

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
      const provider = new ethers.JsonRpcProvider(alchemyUrl);
      
      // Test basic RPC connection
      const network = await provider.getNetwork();
      console.log('Network:', network);
      
      // Test each ABI separately
      console.log('\nTesting uri(uint256)...');
      const contractWithId = new ethers.Contract(CONTRACT_ADDRESS, ERC1155_URI_WITH_ID_ABI, provider);
      try {
        const uri = await contractWithId.uri(TOKEN_ID);
        console.log('URI with ID:', uri);
      } catch (error) {
        console.log('uri(uint256) failed:', error instanceof Error ? error.message : 'Unknown error');
      }

      console.log('\nTesting uri()...');
      const contractBase = new ethers.Contract(CONTRACT_ADDRESS, ERC1155_URI_BASE_ABI, provider);
      try {
        const baseUri = await contractBase.uri();
        console.log('Base URI:', baseUri);
        if (baseUri) {
          const fullUri = baseUri.replace('{id}', TOKEN_ID);
          console.log('Full URI with ID:', fullUri);
        }
      } catch (error) {
        console.log('uri() failed:', error instanceof Error ? error.message : 'Unknown error');
      }

      console.log('\nTesting tokenURI(uint256)...');
      const contractTokenUri = new ethers.Contract(CONTRACT_ADDRESS, ERC1155_TOKEN_URI_ABI, provider);
      try {
        const tokenUri = await contractTokenUri.tokenURI(TOKEN_ID);
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
      const provider = new ethers.JsonRpcProvider(process.env.BASE_MAINNET_RPC);
      
      // Test basic RPC connection
      const network = await provider.getNetwork();
      console.log('Network:', network);
      
      // Test each ABI separately
      console.log('\nTesting uri(uint256)...');
      const contractWithId = new ethers.Contract(CONTRACT_ADDRESS, ERC1155_URI_WITH_ID_ABI, provider);
      try {
        const uri = await contractWithId.uri(TOKEN_ID);
        console.log('URI with ID:', uri);
      } catch (error) {
        console.log('uri(uint256) failed:', error instanceof Error ? error.message : 'Unknown error');
      }

      console.log('\nTesting uri()...');
      const contractBase = new ethers.Contract(CONTRACT_ADDRESS, ERC1155_URI_BASE_ABI, provider);
      try {
        const baseUri = await contractBase.uri();
        console.log('Base URI:', baseUri);
        if (baseUri) {
          const fullUri = baseUri.replace('{id}', TOKEN_ID);
          console.log('Full URI with ID:', fullUri);
        }
      } catch (error) {
        console.log('uri() failed:', error instanceof Error ? error.message : 'Unknown error');
      }

      console.log('\nTesting tokenURI(uint256)...');
      const contractTokenUri = new ethers.Contract(CONTRACT_ADDRESS, ERC1155_TOKEN_URI_ABI, provider);
      try {
        const tokenUri = await contractTokenUri.tokenURI(TOKEN_ID);
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