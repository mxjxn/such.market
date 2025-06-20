-- Migration: Add NFT fetch errors tracking table
-- Description: Track metadata fetch errors for monitoring and retry logic

CREATE TABLE nft_fetch_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  token_id TEXT NOT NULL,
  error_type TEXT NOT NULL, -- 'metadata_fetch', 'token_uri', 'ipfs_gateway', 'validation'
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_nft_fetch_errors_collection ON nft_fetch_errors(collection_id);
CREATE INDEX idx_nft_fetch_errors_type ON nft_fetch_errors(error_type);
CREATE INDEX idx_nft_fetch_errors_created ON nft_fetch_errors(created_at);
CREATE INDEX idx_nft_fetch_errors_retry_count ON nft_fetch_errors(retry_count);

-- Add unique constraint to prevent duplicate errors for the same token
CREATE UNIQUE INDEX idx_nft_fetch_errors_unique ON nft_fetch_errors(collection_id, token_id, error_type);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_nft_fetch_errors_updated_at 
    BEFORE UPDATE ON nft_fetch_errors 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE nft_fetch_errors IS 'Tracks metadata fetch errors for monitoring and retry logic';
COMMENT ON COLUMN nft_fetch_errors.error_type IS 'Type of error: metadata_fetch, token_uri, ipfs_gateway, validation';
COMMENT ON COLUMN nft_fetch_errors.retry_count IS 'Number of retry attempts made for this error'; 