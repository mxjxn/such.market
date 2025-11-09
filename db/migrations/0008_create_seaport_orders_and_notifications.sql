-- Migration: 0008_create_seaport_orders_and_notifications.sql
-- Description: Create Seaport orders, order items, fulfillments, and notifications tables
-- Created: 2024-12-20

-- 1. Create seaport_orders table
CREATE TABLE IF NOT EXISTS seaport_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_hash TEXT UNIQUE NOT NULL,
  offerer_address TEXT NOT NULL,
  fulfiller_address TEXT,
  order_type TEXT NOT NULL, -- 'listing', 'offer', 'auction'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'fulfilled', 'cancelled', 'expired'
  
  -- Order metadata
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  salt TEXT NOT NULL,
  conduit_key TEXT,
  zone_hash TEXT,
  counter BIGINT NOT NULL,
  
  -- Order components (JSONB for flexibility)
  offer_items JSONB NOT NULL, -- Array of OfferItem structs
  consideration_items JSONB NOT NULL, -- Array of ConsiderationItem structs
  
  -- Farcaster integration
  fc_user_id BIGINT,
  frame_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT valid_order_type CHECK (order_type IN ('listing', 'offer', 'auction')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'fulfilled', 'cancelled', 'expired'))
);

-- Indexes for seaport_orders
CREATE INDEX IF NOT EXISTS idx_seaport_orders_offerer ON seaport_orders(offerer_address);
CREATE INDEX IF NOT EXISTS idx_seaport_orders_status ON seaport_orders(status);
CREATE INDEX IF NOT EXISTS idx_seaport_orders_type ON seaport_orders(order_type);
CREATE INDEX IF NOT EXISTS idx_seaport_orders_time ON seaport_orders(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_seaport_orders_hash ON seaport_orders(order_hash);
CREATE INDEX IF NOT EXISTS idx_seaport_orders_fc_user ON seaport_orders(fc_user_id);

-- 2. Create seaport_order_items table (Normalized for efficient querying)
CREATE TABLE IF NOT EXISTS seaport_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES seaport_orders(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- 'offer' or 'consideration'
  token_type INTEGER NOT NULL, -- 0=ETH, 1=ERC20, 2=ERC721, 3=ERC1155
  token_address TEXT,
  token_id TEXT,
  amount TEXT NOT NULL, -- BigNumber as string
  recipient_address TEXT,
  start_amount TEXT,
  end_amount TEXT,
  
  -- For NFT items, link to our existing tables
  collection_id UUID REFERENCES collections(id),
  nft_id UUID REFERENCES nfts(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_item_type CHECK (item_type IN ('offer', 'consideration')),
  CONSTRAINT valid_token_type CHECK (token_type IN (0, 1, 2, 3))
);

-- Indexes for seaport_order_items
CREATE INDEX IF NOT EXISTS idx_order_items_order ON seaport_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_type ON seaport_order_items(item_type);
CREATE INDEX IF NOT EXISTS idx_order_items_token ON seaport_order_items(token_address, token_id);
CREATE INDEX IF NOT EXISTS idx_order_items_collection ON seaport_order_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_order_items_nft ON seaport_order_items(nft_id);

-- 3. Create seaport_fulfillments table
CREATE TABLE IF NOT EXISTS seaport_fulfillments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES seaport_orders(id) ON DELETE CASCADE,
  fulfiller_address TEXT NOT NULL,
  transaction_hash TEXT NOT NULL UNIQUE,
  block_number BIGINT NOT NULL,
  gas_used BIGINT,
  gas_price TEXT,
  
  -- Fulfillment details
  offer_components JSONB NOT NULL,
  consideration_components JSONB NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for seaport_fulfillments
CREATE INDEX IF NOT EXISTS idx_fulfillments_order ON seaport_fulfillments(order_id);
CREATE INDEX IF NOT EXISTS idx_fulfillments_tx ON seaport_fulfillments(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_fulfillments_fulfiller ON seaport_fulfillments(fulfiller_address);
CREATE INDEX IF NOT EXISTS idx_fulfillments_created ON seaport_fulfillments(created_at DESC);

-- 4. Create seaport_notifications table
CREATE TABLE IF NOT EXISTS seaport_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fc_user_id BIGINT NOT NULL,
  order_id UUID REFERENCES seaport_orders(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL, -- 'offer_received', 'listing_sold', 'offer_accepted', 'auction_ending'
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_notification_type CHECK (notification_type IN ('offer_received', 'listing_sold', 'offer_accepted', 'auction_ending'))
);

-- Indexes for seaport_notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON seaport_notifications(fc_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON seaport_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON seaport_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON seaport_notifications(fc_user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON seaport_notifications(created_at DESC);

-- 5. Add Seaport fields to collections table
ALTER TABLE collections ADD COLUMN IF NOT EXISTS seaport_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS royalty_percentage INTEGER DEFAULT 0; -- Basis points (0-10000)
ALTER TABLE collections ADD COLUMN IF NOT EXISTS royalty_recipient TEXT;

-- 6. Add Seaport fields to nfts table
ALTER TABLE nfts ADD COLUMN IF NOT EXISTS current_listing_id UUID REFERENCES seaport_orders(id);
ALTER TABLE nfts ADD COLUMN IF NOT EXISTS last_offer_amount TEXT; -- Latest offer amount
ALTER TABLE nfts ADD COLUMN IF NOT EXISTS last_offer_time TIMESTAMP WITH TIME ZONE;

-- 7. Add trigger to update updated_at timestamp for seaport_orders
CREATE OR REPLACE FUNCTION update_seaport_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_seaport_orders_updated_at 
    BEFORE UPDATE ON seaport_orders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_seaport_orders_updated_at();

