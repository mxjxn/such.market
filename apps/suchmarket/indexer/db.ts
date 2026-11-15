import postgres from 'postgres'

let sql: ReturnType<typeof postgres> | null = null

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}

export function getSql() {
  if (!hasDatabase()) {
    throw new Error('DATABASE_URL is not set')
  }
  if (!sql) {
    sql = postgres(process.env.DATABASE_URL!, {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 15,
    })
  }
  return sql
}

export async function ensureSchema() {
  const fs = await import('fs')
  const path = await import('path')
  const schemaPath = path.join(process.cwd(), 'indexer/schema/001_initial.sql')
  const altPath = path.join(process.cwd(), 'apps/suchmarket/indexer/schema/001_initial.sql')
  const file = fs.existsSync(schemaPath) ? schemaPath : altPath
  const ddl = fs.readFileSync(file, 'utf8')
  const db = getSql()
  await db.unsafe(ddl)
}

export type PoolRow = {
  chain_id: number
  pool_address: string
  nft_address: string
  pool_type: number
  spot_price: string
  delta: string
  fee: string
  bonding_curve: string
  curve_type: string
  token_address: string | null
  owner_address: string | null
  pair_variant: number | null
  nft_id: string | null
  created_block: string
}

export async function upsertPool(row: PoolRow) {
  const db = getSql()
  await db`
    INSERT INTO pools (
      chain_id, pool_address, nft_address, pool_type, spot_price, delta, fee,
      bonding_curve, curve_type, token_address, owner_address, pair_variant, nft_id, created_block
    ) VALUES (
      ${row.chain_id}, ${row.pool_address}, ${row.nft_address}, ${row.pool_type},
      ${row.spot_price}, ${row.delta}, ${row.fee}, ${row.bonding_curve}, ${row.curve_type},
      ${row.token_address}, ${row.owner_address}, ${row.pair_variant}, ${row.nft_id}, ${row.created_block}
    )
    ON CONFLICT (chain_id, pool_address) DO UPDATE SET
      pool_type = EXCLUDED.pool_type,
      spot_price = EXCLUDED.spot_price,
      delta = EXCLUDED.delta,
      fee = EXCLUDED.fee,
      bonding_curve = EXCLUDED.bonding_curve,
      curve_type = EXCLUDED.curve_type,
      token_address = EXCLUDED.token_address,
      owner_address = EXCLUDED.owner_address,
      pair_variant = EXCLUDED.pair_variant,
      nft_id = EXCLUDED.nft_id,
      updated_at = NOW()
  `
}

export async function getCursor(chainId: number, cursorKey: string): Promise<bigint> {
  const db = getSql()
  const rows = await db<{ last_block: string }[]>`
    SELECT last_block::text FROM indexer_cursors
    WHERE chain_id = ${chainId} AND cursor_key = ${cursorKey}
  `
  if (rows.length === 0) return 0n
  return BigInt(rows[0].last_block)
}

export async function setCursor(chainId: number, cursorKey: string, lastBlock: bigint) {
  const db = getSql()
  await db`
    INSERT INTO indexer_cursors (chain_id, cursor_key, last_block)
    VALUES (${chainId}, ${cursorKey}, ${lastBlock.toString()})
    ON CONFLICT (chain_id, cursor_key) DO UPDATE SET
      last_block = EXCLUDED.last_block,
      updated_at = NOW()
  `
}

export async function listPoolsFromDb(
  chainId: number,
  opts?: { nft?: string; owner?: string; limit?: number }
) {
  const db = getSql()
  const limit = opts?.limit ?? 500
  const nft = opts?.nft?.toLowerCase()
  const owner = opts?.owner?.toLowerCase()

  if (nft && owner) {
    return db<PoolRow[]>`
      SELECT * FROM pools
      WHERE chain_id = ${chainId}
        AND lower(nft_address) = ${nft}
        AND lower(owner_address) = ${owner}
      ORDER BY spot_price ASC
      LIMIT ${limit}
    `
  }
  if (nft) {
    return db<PoolRow[]>`
      SELECT * FROM pools WHERE chain_id = ${chainId} AND lower(nft_address) = ${nft}
      ORDER BY spot_price ASC LIMIT ${limit}
    `
  }
  if (owner) {
    return db<PoolRow[]>`
      SELECT * FROM pools WHERE chain_id = ${chainId} AND lower(owner_address) = ${owner}
      ORDER BY spot_price ASC LIMIT ${limit}
    `
  }
  return db<PoolRow[]>`
    SELECT * FROM pools WHERE chain_id = ${chainId}
    ORDER BY updated_at DESC LIMIT ${limit}
  `
}

export async function listPoolAddresses(chainId: number): Promise<string[]> {
  const db = getSql()
  const rows = await db<{ pool_address: string }[]>`
    SELECT pool_address FROM pools WHERE chain_id = ${chainId}
  `
  return rows.map((r) => r.pool_address)
}

export async function upsertListing(row: {
  chain_id: number
  listing_id: string
  listing_type: number | null
  seller: string | null
  token_address: string | null
  token_id: string | null
  erc20: string | null
  start_time: string | null
  end_time: string | null
  initial_amount: string | null
  created_block: string
}) {
  const db = getSql()
  await db`
    INSERT INTO marketplace_listings (
      chain_id, listing_id, listing_type, seller, token_address, token_id, erc20,
      start_time, end_time, initial_amount, created_block
    ) VALUES (
      ${row.chain_id}, ${row.listing_id}, ${row.listing_type}, ${row.seller}, ${row.token_address},
      ${row.token_id}, ${row.erc20}, ${row.start_time}, ${row.end_time}, ${row.initial_amount}, ${row.created_block}
    )
    ON CONFLICT (chain_id, listing_id) DO NOTHING
  `
}

export async function refreshListingState(
  chainId: number,
  listingId: bigint,
  state: {
    finalized: boolean
    current_bid_amount: string | null
    current_bidder: string | null
  }
) {
  const db = getSql()
  await db`
    UPDATE marketplace_listings SET
      finalized = ${state.finalized},
      current_bid_amount = ${state.current_bid_amount},
      current_bidder = ${state.current_bidder},
      refreshed_at = NOW()
    WHERE chain_id = ${chainId} AND listing_id = ${listingId.toString()}
  `
}

export async function listAuctionListingIds(chainId: number, limit: number): Promise<bigint[]> {
  const db = getSql()
  const rows = await db<{ listing_id: string }[]>`
    SELECT listing_id::text FROM marketplace_listings
    WHERE chain_id = ${chainId}
      AND listing_type = 0
      AND finalized = FALSE
    ORDER BY created_block DESC
    LIMIT ${limit}
  `
  return rows.map((r) => BigInt(r.listing_id))
}