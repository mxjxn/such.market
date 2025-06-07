-- Migration: 0001_seed_initial_data.sql
-- Description: Seed initial collections data
-- Created: 2024-03-21

-- Insert known collections
INSERT INTO collections (contract_address, name, token_type, verified)
VALUES 
    ('0x0c2e57efddba8c768147d1fdf9176a0a6ebd5d83', 'Based Dickbutts', 'ERC721', true),
    ('0x7ef6a7b2b72a60ac7f6aacf0e6cf5a7b7d0f2c2a', 'Based Ghouls', 'ERC721', true),
    ('0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d', 'Based Apes', 'ERC721', true)
ON CONFLICT (contract_address) 
DO UPDATE SET 
    name = EXCLUDED.name,
    token_type = EXCLUDED.token_type,
    verified = EXCLUDED.verified,
    updated_at = now(); 