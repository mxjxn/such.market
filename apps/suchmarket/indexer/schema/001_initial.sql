-- such.market RPC indexer schema (Postgres)
-- Apply: psql $DATABASE_URL -f apps/suchmarket/indexer/schema/001_initial.sql

CREATE TABLE IF NOT EXISTS indexer_cursors (
  chain_id INTEGER NOT NULL,
  cursor_key TEXT NOT NULL,
  last_block BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, cursor_key)
);

CREATE TABLE IF NOT EXISTS pools (
  chain_id INTEGER NOT NULL,
  pool_address TEXT NOT NULL,
  nft_address TEXT NOT NULL,
  pool_type SMALLINT NOT NULL,
  spot_price NUMERIC NOT NULL,
  delta NUMERIC NOT NULL,
  fee NUMERIC NOT NULL,
  bonding_curve TEXT NOT NULL,
  curve_type TEXT NOT NULL,
  token_address TEXT,
  owner_address TEXT,
  pair_variant SMALLINT,
  nft_id NUMERIC,
  created_block BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chain_id, pool_address)
);

CREATE INDEX IF NOT EXISTS idx_pools_chain_nft ON pools (chain_id, nft_address);
CREATE INDEX IF NOT EXISTS idx_pools_chain_owner ON pools (chain_id, owner_address);

CREATE TABLE IF NOT EXISTS pool_events (
  id BIGSERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  pool_address TEXT NOT NULL,
  event_type TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chain_id, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_pool_events_pool ON pool_events (chain_id, pool_address, block_number DESC);

CREATE TABLE IF NOT EXISTS marketplace_listings (
  chain_id INTEGER NOT NULL,
  listing_id BIGINT NOT NULL,
  listing_type SMALLINT,
  seller TEXT,
  token_address TEXT,
  token_id NUMERIC,
  erc20 TEXT,
  start_time BIGINT,
  end_time BIGINT,
  initial_amount NUMERIC,
  created_block BIGINT NOT NULL,
  finalized BOOLEAN NOT NULL DEFAULT FALSE,
  current_bid_amount NUMERIC,
  current_bidder TEXT,
  refreshed_at TIMESTAMPTZ,
  PRIMARY KEY (chain_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_listings_auctions ON marketplace_listings (chain_id, listing_type, finalized);