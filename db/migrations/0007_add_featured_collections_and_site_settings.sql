-- Migration: 0007_add_featured_collections_and_site_settings.sql
-- Description: Add featured collections flag and site settings table for admin-configurable content
-- Created: 2024-12-20

-- Add featured column to collections table
ALTER TABLE collections ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE;

-- Create index for featured collections
CREATE INDEX IF NOT EXISTS idx_collections_featured ON collections(featured) WHERE featured = TRUE;

-- Create site_settings table for admin-configurable content
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by_fid BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for site settings key lookups
CREATE INDEX IF NOT EXISTS idx_site_settings_key ON site_settings(key);

-- Insert default hero CTA messages
INSERT INTO site_settings (key, value) 
VALUES 
  ('hero_cta_authenticated', 'Climb the leaderboard!'),
  ('hero_cta_unauthenticated', 'Claim your profile')
ON CONFLICT (key) DO NOTHING;

