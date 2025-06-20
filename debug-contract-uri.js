const { createPublicClient, http, parseAbiItem } = require('viem');
const { base } = require('viem/chains');

// Initialize viem client
const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_MAINNET_RPC),
});

async function debugContractURI() {
  const contractAddress = '0x19b067377d7ad8ab31c56e749c66cd60695ba657';
  const tokenId = '1';
  
  console.log(`🔍 [Debug] Checking contract URI for token ${tokenId}`);
  
  try {
    // Try ERC721 tokenURI first
    console.log(`🔍 [Debug] Trying ERC721 tokenURI...`);
    try {
      const tokenURI = await client.readContract({
        address: contractAddress,
        abi: [parseAbiItem('function tokenURI(uint256 tokenId) view returns (string)')],
        functionName: 'tokenURI',
        args: [BigInt(tokenId)],
      });
      console.log(`✅ [Debug] ERC721 tokenURI: ${tokenURI}`);
    } catch (error) {
      console.log(`❌ [Debug] ERC721 tokenURI failed:`, error.message);
    }
    
    // Try ERC1155 uri
    console.log(`🔍 [Debug] Trying ERC1155 uri...`);
    try {
      const uri = await client.readContract({
        address: contractAddress,
        abi: [parseAbiItem('function uri(uint256 tokenId) view returns (string)')],
        functionName: 'uri',
        args: [BigInt(tokenId)],
      });
      console.log(`✅ [Debug] ERC1155 uri: ${uri}`);
      
      // Test the {id} replacement
      if (uri.includes('{id}')) {
        const hexId = BigInt(tokenId).toString(16).padStart(64, '0');
        const processedUri = uri.replace('{id}', hexId);
        console.log(`🔄 [Debug] Replaced {id} with hex: ${hexId}`);
        console.log(`🔗 [Debug] Processed URI: ${processedUri}`);
        
        // Try to fetch the metadata
        console.log(`🔍 [Debug] Testing metadata fetch...`);
        try {
          const response = await fetch(processedUri);
          console.log(`📊 [Debug] Response status: ${response.status}`);
          if (response.ok) {
            const text = await response.text();
            console.log(`📄 [Debug] Response body:`, text);
            const metadata = JSON.parse(text);
            console.log(`✅ [Debug] Parsed metadata:`, metadata);
          } else {
            console.log(`❌ [Debug] HTTP error: ${response.status} ${response.statusText}`);
          }
        } catch (error) {
          console.log(`❌ [Debug] Fetch failed:`, error.message);
        }
      }
    } catch (error) {
      console.log(`❌ [Debug] ERC1155 uri failed:`, error.message);
    }
    
  } catch (error) {
    console.error(`❌ [Debug] Unexpected error:`, error);
  }
}

debugContractURI().catch(console.error); 