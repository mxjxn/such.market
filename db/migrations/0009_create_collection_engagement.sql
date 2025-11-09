-- Migration: 0009_create_collection_engagement.sql
-- Description: Create collection engagement tracking table for smart profile prioritization
-- Created: 2024-12-20

CREATE TABLE IF NOT EXISTS collection_engagement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  view_count_24h INTEGER DEFAULT 0,
  view_count_7d INTEGER DEFAULT 0,
  view_count_30d INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMP WITH TIME ZONE,
  engagement_score DECIMAL(10, 2) DEFAULT 0, -- Calculated: weighted sum of view counts
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(collection_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_collection_engagement_score ON collection_engagement(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_collection_engagement_24h ON collection_engagement(view_count_24h DESC);
CREATE INDEX IF NOT EXISTS idx_collection_engagement_collection ON collection_engagement(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_engagement_updated ON collection_engagement(updated_at DESC);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_collection_engagement_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_collection_engagement_updated_at 
    BEFORE UPDATE ON collection_engagement 
    FOR EACH ROW 
    EXECUTE FUNCTION update_collection_engagement_updated_at();

-- Add comments for documentation
COMMENT ON TABLE collection_engagement IS 'Tracks collection-level engagement metrics for smart profile prioritization';
COMMENT ON COLUMN collection_engagement.engagement_score IS 'Calculated score: (view_count_24h * 1.0) + (view_count_7d * 0.3) + (view_count_30d * 0.1)';

