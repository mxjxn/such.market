const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugCollection() {
  const contractAddress = '0x19b067377d7ad8ab31c56e749c66cd60695ba657';
  
  console.log(`🔍 Debugging collection: ${contractAddress}`);
  
  // Get collection info
  const { data: collection, error: collectionError } = await supabase
    .from('collections')
    .select('*')
    .eq('contract_address', contractAddress.toLowerCase())
    .single();
    
  if (collectionError) {
    console.error('❌ Collection error:', collectionError);
    return;
  }
  
  console.log('📋 Collection info:', {
    id: collection.id,
    name: collection.name,
    token_type: collection.token_type,
    total_supply: collection.total_supply,
    verified: collection.verified,
    last_refresh_at: collection.last_refresh_at,
  });
  
  // Get NFTs in collection
  const { data: nfts, error: nftsError } = await supabase
    .from('nfts')
    .select('*')
    .eq('collection_id', collection.id)
    .order('token_id', { ascending: true });
    
  if (nftsError) {
    console.error('❌ NFTs error:', nftsError);
    return;
  }
  
  console.log(`📊 Found ${nfts?.length || 0} NFTs in database`);
  
  if (nfts && nfts.length > 0) {
    console.log('📋 NFT token IDs:', nfts.map(nft => nft.token_id));
    console.log('📋 NFT details:', nfts.map(nft => ({
      token_id: nft.token_id,
      title: nft.title,
      has_image: !!nft.image_url,
      has_metadata: !!nft.metadata,
    })));
  } else {
    console.log('⚠️ No NFTs found in database');
  }
}

debugCollection().catch(console.error); 