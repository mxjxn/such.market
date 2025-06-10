-- Migration: 0002_add_user_nft_cache.sql
-- Description: Add user_nft_cache table for caching NFT contract data
-- Created: 2024-12-19

-- Create user_nft_cache table
CREATE TABLE IF NOT EXISTS user_nft_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  wallet_address TEXT NOT NULL,
  contracts JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on cache_key for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_nft_cache_key ON user_nft_cache(cache_key);

-- Create index on created_at for cache expiration queries
CREATE INDEX IF NOT EXISTS idx_user_nft_cache_created_at ON user_nft_cache(created_at);

-- Create index on wallet_address for wallet-specific queries
CREATE INDEX IF NOT EXISTS idx_user_nft_cache_wallet_address ON user_nft_cache(wallet_address); 