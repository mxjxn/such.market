-- Migration: 0003_create_normalized_ownership_tables.sql
-- Description: Create normalized ownership tracking tables to replace user_nft_cache
-- Created: 2024-12-19

-- Create nft_ownership table for individual NFT ownership tracking
CREATE TABLE IF NOT EXISTS nft_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  token_id TEXT NOT NULL,
  owner_address TEXT NOT NULL,
  last_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(collection_id, token_id, owner_address)
);

-- Create user_collections table for user collection summaries
CREATE TABLE IF NOT EXISTS user_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_address TEXT NOT NULL,
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  token_count INTEGER DEFAULT 0,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_address, collection_id)
);

-- Create wallet_collection_mapping table for wallet-to-collection relationships
CREATE TABLE IF NOT EXISTS wallet_collection_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  collection_address TEXT NOT NULL,
  token_count INTEGER DEFAULT 0,
  last_owned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(wallet_address, collection_address)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nft_ownership_owner ON nft_ownership(owner_address);
CREATE INDEX IF NOT EXISTS idx_nft_ownership_collection ON nft_ownership(collection_id);
CREATE INDEX IF NOT EXISTS idx_nft_ownership_verified ON nft_ownership(last_verified_at);
CREATE INDEX IF NOT EXISTS idx_nft_ownership_token ON nft_ownership(collection_id, token_id);

CREATE INDEX IF NOT EXISTS idx_user_collections_user ON user_collections(user_address);
CREATE INDEX IF NOT EXISTS idx_user_collections_collection ON user_collections(collection_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_updated ON user_collections(last_updated_at);

CREATE INDEX IF NOT EXISTS idx_wallet_collection_mapping_wallet ON wallet_collection_mapping(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_collection_mapping_collection ON wallet_collection_mapping(collection_address);
CREATE INDEX IF NOT EXISTS idx_wallet_collection_mapping_owned ON wallet_collection_mapping(last_owned_at);

-- Create function to update user_collections when nft_ownership changes
CREATE OR REPLACE FUNCTION update_user_collection_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user_collections table when nft_ownership changes
  IF TG_OP = 'INSERT' THEN
    INSERT INTO user_collections (user_address, collection_id, token_count, last_updated_at)
    VALUES (NEW.owner_address, NEW.collection_id, 1, NOW())
    ON CONFLICT (user_address, collection_id)
    DO UPDATE SET 
      token_count = user_collections.token_count + 1,
      last_updated_at = NOW(),
      updated_at = NOW();
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE user_collections 
    SET 
      token_count = GREATEST(token_count - 1, 0),
      last_updated_at = NOW(),
      updated_at = NOW()
    WHERE user_address = OLD.owner_address AND collection_id = OLD.collection_id;
    
    -- Delete user_collection if token_count becomes 0
    DELETE FROM user_collections 
    WHERE user_address = OLD.owner_address 
      AND collection_id = OLD.collection_id 
      AND token_count = 0;
    
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle ownership transfer
    IF OLD.owner_address != NEW.owner_address THEN
      -- Decrease count for old owner
      UPDATE user_collections 
      SET 
        token_count = GREATEST(token_count - 1, 0),
        last_updated_at = NOW(),
        updated_at = NOW()
      WHERE user_address = OLD.owner_address AND collection_id = OLD.collection_id;
      
      -- Delete user_collection if token_count becomes 0
      DELETE FROM user_collections 
      WHERE user_address = OLD.owner_address 
        AND collection_id = OLD.collection_id 
        AND token_count = 0;
      
      -- Increase count for new owner
      INSERT INTO user_collections (user_address, collection_id, token_count, last_updated_at)
      VALUES (NEW.owner_address, NEW.collection_id, 1, NOW())
      ON CONFLICT (user_address, collection_id)
      DO UPDATE SET 
        token_count = user_collections.token_count + 1,
        last_updated_at = NOW(),
        updated_at = NOW();
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update user_collections
CREATE TRIGGER trigger_update_user_collection_count
  AFTER INSERT OR UPDATE OR DELETE ON nft_ownership
  FOR EACH ROW EXECUTE FUNCTION update_user_collection_count();

-- Create function to update wallet_collection_mapping when nft_ownership changes
CREATE OR REPLACE FUNCTION update_wallet_collection_mapping()
RETURNS TRIGGER AS $$
BEGIN
  -- Update wallet_collection_mapping table when nft_ownership changes
  IF TG_OP = 'INSERT' THEN
    INSERT INTO wallet_collection_mapping (wallet_address, collection_address, token_count, last_owned_at)
    SELECT 
      NEW.owner_address,
      c.contract_address,
      1,
      NOW()
    FROM collections c
    WHERE c.id = NEW.collection_id
    ON CONFLICT (wallet_address, collection_address)
    DO UPDATE SET 
      token_count = wallet_collection_mapping.token_count + 1,
      last_owned_at = NOW(),
      updated_at = NOW();
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE wallet_collection_mapping 
    SET 
      token_count = GREATEST(token_count - 1, 0),
      updated_at = NOW()
    WHERE wallet_address = OLD.owner_address 
      AND collection_address = (
        SELECT contract_address 
        FROM collections 
        WHERE id = OLD.collection_id
      );
    
    -- Delete mapping if token_count becomes 0
    DELETE FROM wallet_collection_mapping 
    WHERE wallet_address = OLD.owner_address 
      AND collection_address = (
        SELECT contract_address 
        FROM collections 
        WHERE id = OLD.collection_id
      )
      AND token_count = 0;
    
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle ownership transfer
    IF OLD.owner_address != NEW.owner_address THEN
      -- Decrease count for old owner
      UPDATE wallet_collection_mapping 
      SET 
        token_count = GREATEST(token_count - 1, 0),
        updated_at = NOW()
      WHERE wallet_address = OLD.owner_address 
        AND collection_address = (
          SELECT contract_address 
          FROM collections 
          WHERE id = OLD.collection_id
        );
      
      -- Delete mapping if token_count becomes 0
      DELETE FROM wallet_collection_mapping 
      WHERE wallet_address = OLD.owner_address 
        AND collection_address = (
          SELECT contract_address 
          FROM collections 
          WHERE id = OLD.collection_id
        )
        AND token_count = 0;
      
      -- Increase count for new owner
      INSERT INTO wallet_collection_mapping (wallet_address, collection_address, token_count, last_owned_at)
      SELECT 
        NEW.owner_address,
        c.contract_address,
        1,
        NOW()
      FROM collections c
      WHERE c.id = NEW.collection_id
      ON CONFLICT (wallet_address, collection_address)
      DO UPDATE SET 
        token_count = wallet_collection_mapping.token_count + 1,
        last_owned_at = NOW(),
        updated_at = NOW();
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update wallet_collection_mapping
CREATE TRIGGER trigger_update_wallet_collection_mapping
  AFTER INSERT OR UPDATE OR DELETE ON nft_ownership
  FOR EACH ROW EXECUTE FUNCTION update_wallet_collection_mapping(); 