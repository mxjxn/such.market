-- Migration: 0005_remove_user_nft_cache.sql
-- Description: Remove the old user_nft_cache table after migration to normalized system
-- Created: 2024-12-19
-- WARNING: Only run this after confirming the new normalized system is working correctly

-- First, verify that we have data in the new normalized tables
DO $$
DECLARE
  ownership_count INTEGER;
  mapping_count INTEGER;
  cache_count INTEGER;
BEGIN
  -- Check counts in new tables
  SELECT COUNT(*) INTO ownership_count FROM nft_ownership;
  SELECT COUNT(*) INTO mapping_count FROM wallet_collection_mapping;
  SELECT COUNT(*) INTO cache_count FROM user_nft_cache;
  
  -- Log the counts for verification
  RAISE NOTICE 'Ownership records: %, Mapping records: %, Cache records: %', 
    ownership_count, mapping_count, cache_count;
    
  -- Only proceed if we have data in the new tables
  IF ownership_count = 0 AND mapping_count = 0 THEN
    RAISE EXCEPTION 'New normalized tables are empty. Please run migration 0004 first.';
  END IF;
END $$;

-- Drop indexes on user_nft_cache
DROP INDEX IF EXISTS idx_user_nft_cache_key;
DROP INDEX IF EXISTS idx_user_nft_cache_created_at;
DROP INDEX IF EXISTS idx_user_nft_cache_wallet_address;

-- Drop the user_nft_cache table
DROP TABLE IF EXISTS user_nft_cache;

-- Add a comment to track the removal
COMMENT ON TABLE nft_ownership IS 'Normalized NFT ownership tracking - replaces user_nft_cache';
COMMENT ON TABLE wallet_collection_mapping IS 'Wallet-to-collection mappings - replaces user_nft_cache.contracts'; 