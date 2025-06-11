-- Migration: 0004_migrate_existing_ownership_data.sql
-- Description: Migrate existing ownership data to new normalized tables
-- Created: 2024-12-19

-- Temporarily disable triggers to avoid conflicts during migration
DROP TRIGGER IF EXISTS trigger_update_user_collection_count ON nft_ownership;
DROP TRIGGER IF EXISTS trigger_update_wallet_collection_mapping ON nft_ownership;

-- Step 1: Migrate existing NFT ownership data from nfts table
-- Use GROUP BY to ensure no duplicates
INSERT INTO nft_ownership (collection_id, token_id, owner_address, last_verified_at, created_at, updated_at)
SELECT 
  n.collection_id,
  n.token_id,
  n.owner_address,
  MAX(COALESCE(n.last_owner_check_at, NOW())) as last_verified_at,
  MIN(n.created_at) as created_at,
  MAX(n.updated_at) as updated_at
FROM nfts n
WHERE n.owner_address IS NOT NULL
  AND n.owner_address != ''
GROUP BY n.collection_id, n.token_id, n.owner_address
ON CONFLICT (collection_id, token_id, owner_address) DO NOTHING;

-- Step 2: Migrate wallet collection mappings from user_nft_cache table
-- Use GROUP BY to aggregate duplicate wallet-collection pairs
INSERT INTO wallet_collection_mapping (wallet_address, collection_address, token_count, last_owned_at, created_at, updated_at)
SELECT 
  unc.wallet_address,
  (contract->>'address')::TEXT as collection_address,
  SUM(COALESCE((contract->>'totalBalance')::INTEGER, 0)) as token_count,
  MAX(unc.updated_at) as last_owned_at,
  MAX(unc.created_at) as created_at,
  MAX(unc.updated_at) as updated_at
FROM user_nft_cache unc,
     jsonb_array_elements(unc.contracts) as contract
WHERE unc.contracts IS NOT NULL 
  AND unc.contracts != '[]'::jsonb
  AND contract->>'address' IS NOT NULL
  AND (contract->>'address')::TEXT IS NOT NULL
GROUP BY unc.wallet_address, (contract->>'address')::TEXT
ON CONFLICT (wallet_address, collection_address) 
DO UPDATE SET 
  token_count = EXCLUDED.token_count,
  last_owned_at = EXCLUDED.last_owned_at,
  updated_at = EXCLUDED.updated_at;

-- Step 3: Populate user_collections table based on nft_ownership data
-- This is already properly aggregated, so no changes needed
INSERT INTO user_collections (user_address, collection_id, token_count, last_updated_at, created_at, updated_at)
SELECT 
  no.owner_address as user_address,
  no.collection_id,
  COUNT(*) as token_count,
  MAX(no.last_verified_at) as last_updated_at,
  MIN(no.created_at) as created_at,
  MAX(no.updated_at) as updated_at
FROM nft_ownership no
GROUP BY no.owner_address, no.collection_id
ON CONFLICT (user_address, collection_id) 
DO UPDATE SET 
  token_count = EXCLUDED.token_count,
  last_updated_at = EXCLUDED.last_updated_at,
  updated_at = EXCLUDED.updated_at;

-- Re-enable triggers
CREATE TRIGGER trigger_update_user_collection_count
  AFTER INSERT OR UPDATE OR DELETE ON nft_ownership
  FOR EACH ROW EXECUTE FUNCTION update_user_collection_count();

CREATE TRIGGER trigger_update_wallet_collection_mapping
  AFTER INSERT OR UPDATE OR DELETE ON nft_ownership
  FOR EACH ROW EXECUTE FUNCTION update_wallet_collection_mapping();

-- Add a comment to track migration completion
COMMENT ON TABLE nft_ownership IS 'Normalized NFT ownership tracking - migrated from nfts.owner_address';
COMMENT ON TABLE user_collections IS 'User collection summaries - auto-maintained by triggers';
COMMENT ON TABLE wallet_collection_mapping IS 'Wallet-to-collection mappings - migrated from user_nft_cache.contracts'; 