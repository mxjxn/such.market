/**
 * Pool index: Postgres when DATABASE_URL is set, else on-demand RPC log scan.
 */
export type { IndexedPool } from './rpc-pools'
export { discoverPools, getPoolByAddress, enrichPoolOnly } from './rpc-pools'

import { Address } from 'viem'
import { discoverPools, type IndexedPool } from './rpc-pools'
import { hasDatabase, listPoolsFromDb, type PoolRow } from '@/indexer/db'

function rowToIndexed(row: PoolRow): IndexedPool {
  return {
    poolAddress: row.pool_address as Address,
    nft: row.nft_address as Address,
    poolType: row.pool_type,
    spotPrice: BigInt(row.spot_price),
    delta: BigInt(row.delta),
    fee: BigInt(row.fee),
    bondingCurve: row.bonding_curve as Address,
    curveType: row.curve_type,
    token: row.token_address as Address | null,
    owner: row.owner_address as Address | null,
    pairVariant: row.pair_variant,
    nftId: row.nft_id ? BigInt(row.nft_id) : null,
    createdBlock: BigInt(row.created_block),
  }
}

export async function queryPools(options: {
  chainId: number
  nftContract?: Address
  owner?: Address
  lookbackBlocks?: bigint
}): Promise<{ pools: IndexedPool[]; source: 'postgres' | 'rpc' }> {
  if (hasDatabase()) {
    try {
      const rows = await listPoolsFromDb(options.chainId, {
        nft: options.nftContract,
        owner: options.owner,
      })
      if (rows.length > 0) {
        return { pools: rows.map(rowToIndexed), source: 'postgres' }
      }
    } catch (e) {
      console.warn('[queryPools] postgres read failed, falling back to RPC', e)
    }
  }
  const pools = await discoverPools(options)
  return { pools, source: 'rpc' }
}