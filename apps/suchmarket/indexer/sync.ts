import {
  Address,
  Log,
  decodeEventLog,
  getAddress,
  parseAbiItem,
} from 'viem'
import { discoverPools, enrichPoolOnly, type IndexedPool } from '@/lib/rpc-pools'
import { getPublicClient } from '@/lib/rpc'
import {
  getIndexerChainConfigs,
  getMarketplaceChainConfigs,
  getIndexerMaxBlocksPerRun,
  getIndexerLogChunk,
  type ChainRuntimeConfig,
} from '@/lib/chain-config'
import { getFactoryAddress } from '@/lib/contracts'
import { MARKETPLACE_ABI } from '@/lib/marketplace'
import {
  ensureSchema,
  getCursor,
  setCursor,
  upsertPool,
  upsertListing,
  listPoolAddresses,
  refreshListingState,
  listAuctionListingIds,
  hasDatabase,
} from './db'
import { getMarketplaceAddress, type ContractListing } from '@/lib/marketplace'

const NEW_ERC721_PAIR = parseAbiItem(
  'event NewERC721Pair(address indexed poolAddress, uint256[] initialIds)'
)
const NEW_ERC1155_PAIR = parseAbiItem(
  'event NewERC1155Pair(address indexed poolAddress, uint256 initialBalance)'
)
const CREATE_LISTING = parseAbiItem(
  'event CreateListing(uint40 indexed listingId, uint16 marketplaceBPS, uint16 referrerBPS, uint8 listingType, uint24 totalAvailable, uint24 totalPerSale, uint48 startTime, uint48 endTime, uint256 initialAmount, uint16 extensionInterval, uint16 minIncrementBPS, address erc20, address identityVerifier)'
)

const SPOT_PRICE = parseAbiItem('event SpotPriceUpdate(uint128 newSpotPrice)')
const DELTA_UPDATE = parseAbiItem('event DeltaUpdate(uint128 newDelta)')
const NFT_DEPOSIT = parseAbiItem('event NFTDeposit(address indexed poolAddress, uint256[] ids)')

const CURSOR_FACTORY = 'factory_pools'
const CURSOR_MARKETPLACE = 'marketplace_listings'
const CURSOR_PAIR_EVENTS = 'pair_events'

async function getLogsChunked(
  chainId: number,
  filter: {
    address: Address | Address[]
    event:
      | typeof NEW_ERC721_PAIR
      | typeof NEW_ERC1155_PAIR
      | typeof SPOT_PRICE
      | typeof DELTA_UPDATE
      | typeof NFT_DEPOSIT
      | typeof CREATE_LISTING
  },
  fromBlock: bigint,
  toBlock: bigint
): Promise<Log[]> {
  const client = getPublicClient(chainId)
  const chunk = getIndexerLogChunk()
  const logs: Log[] = []
  let start = fromBlock
  while (start <= toBlock) {
    const end = start + chunk - 1n > toBlock ? toBlock : start + chunk - 1n
    try {
      const batch = await client.getLogs({
        address: filter.address,
        event: filter.event,
        fromBlock: start,
        toBlock: end,
      })
      logs.push(...batch)
    } catch (error) {
      console.warn(`[indexer] getLogs ${chainId} ${start}-${end}:`, error)
      await new Promise((r) => setTimeout(r, 300))
    }
    start = end + 1n
  }
  return logs
}

function toPoolRow(chainId: number, pool: IndexedPool) {
  return {
    chain_id: chainId,
    pool_address: pool.poolAddress.toLowerCase(),
    nft_address: pool.nft.toLowerCase(),
    pool_type: pool.poolType,
    spot_price: pool.spotPrice.toString(),
    delta: pool.delta.toString(),
    fee: pool.fee.toString(),
    bonding_curve: pool.bondingCurve.toLowerCase(),
    curve_type: pool.curveType,
    token_address: pool.token?.toLowerCase() ?? null,
    owner_address: pool.owner?.toLowerCase() ?? null,
    pair_variant: pool.pairVariant,
    nft_id: pool.nftId?.toString() ?? null,
    created_block: pool.createdBlock.toString(),
  }
}

async function syncFactoryPools(cfg: ChainRuntimeConfig) {
  const client = getPublicClient(cfg.id)
  const factory = getFactoryAddress(cfg.id)
  const latest = await client.getBlockNumber()
  const startBlock = (await getCursor(cfg.id, CURSOR_FACTORY)) || cfg.factoryStartBlock
  const maxRun = getIndexerMaxBlocksPerRun()
  const toBlock = startBlock + maxRun < latest ? startBlock + maxRun : latest
  if (toBlock < startBlock) return { pools: 0, toBlock: startBlock }

  const from = startBlock > 0n ? startBlock : cfg.factoryStartBlock
  const [erc721Logs, erc1155Logs] = await Promise.all([
    getLogsChunked(cfg.id, { address: factory, event: NEW_ERC721_PAIR }, from, toBlock),
    getLogsChunked(cfg.id, { address: factory, event: NEW_ERC1155_PAIR }, from, toBlock),
  ])

  const created = new Map<string, bigint>()
  for (const log of [...erc721Logs, ...erc1155Logs]) {
    try {
      const decoded = decodeEventLog({
        abi: [NEW_ERC721_PAIR, NEW_ERC1155_PAIR],
        data: log.data,
        topics: log.topics,
      })
      const poolAddress = (decoded.args as { poolAddress: Address }).poolAddress
      if (poolAddress) {
        created.set(getAddress(poolAddress).toLowerCase(), log.blockNumber ?? 0n)
      }
    } catch {
      /* skip */
    }
  }

  let upserted = 0
  const entries = [...created.entries()]
  const BATCH = 8
  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH)
    const enriched = await Promise.all(
      slice.map(([addr, block]) => enrichPoolOnly(cfg.id, getAddress(addr), block))
    )
    for (const pool of enriched) {
      if (!pool) continue
      await upsertPool(toPoolRow(cfg.id, pool))
      upserted++
    }
  }

  await setCursor(cfg.id, CURSOR_FACTORY, toBlock)
  return { pools: upserted, toBlock }
}

async function syncPairEvents(cfg: ChainRuntimeConfig) {
  const client = getPublicClient(cfg.id)
  const latest = await client.getBlockNumber()
  const cursor = await getCursor(cfg.id, CURSOR_PAIR_EVENTS)
  const from = cursor > 0n ? cursor : cfg.factoryStartBlock
  const to = from + getIndexerMaxBlocksPerRun() < latest ? from + getIndexerMaxBlocksPerRun() : latest
  if (to <= from) return { events: 0 }

  const addresses = await listPoolAddresses(cfg.id)
  if (addresses.length === 0) {
    await setCursor(cfg.id, CURSOR_PAIR_EVENTS, to)
    return { events: 0 }
  }

  const addrBatch = addresses.slice(0, 40) as Address[]
  const logs = await getLogsChunked(
    cfg.id,
    { address: addrBatch, event: SPOT_PRICE },
    from + 1n,
    to
  )

  const touched = new Set<string>()
  for (const log of logs) {
    if (log.address) touched.add(log.address.toLowerCase())
  }

  for (const addr of touched) {
    const pool = await enrichPoolOnly(cfg.id, getAddress(addr), 0n)
    if (pool) await upsertPool(toPoolRow(cfg.id, pool))
  }

  // Factory NFT deposits (indexed pool address)
  const factory = getFactoryAddress(cfg.id)
  const depositLogs = await getLogsChunked(
    cfg.id,
    { address: factory, event: NFT_DEPOSIT },
    from + 1n,
    to
  )
  void depositLogs

  // Delta updates on same pool batch
  const deltaLogs = await getLogsChunked(
    cfg.id,
    { address: addrBatch, event: DELTA_UPDATE },
    from + 1n,
    to
  )
  for (const log of deltaLogs) {
    if (log.address) touched.add(log.address.toLowerCase())
  }
  for (const addr of touched) {
    const pool = await enrichPoolOnly(cfg.id, getAddress(addr), 0n)
    if (pool) await upsertPool(toPoolRow(cfg.id, pool))
  }

  await setCursor(cfg.id, CURSOR_PAIR_EVENTS, to)
  return { events: logs.length + deltaLogs.length }
}

async function syncMarketplaceListings(cfg: ChainRuntimeConfig) {
  const marketplace = cfg.marketplaceAddress!
  const client = getPublicClient(cfg.id)
  const latest = await client.getBlockNumber()
  const from = (await getCursor(cfg.id, CURSOR_MARKETPLACE)) || cfg.marketplaceStartBlock
  const to = from + getIndexerMaxBlocksPerRun() < latest ? from + getIndexerMaxBlocksPerRun() : latest

  const logs = await getLogsChunked(
    cfg.id,
    { address: marketplace, event: CREATE_LISTING },
    from > 0n ? from : cfg.marketplaceStartBlock,
    to
  )

  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: [CREATE_LISTING],
        data: log.data,
        topics: log.topics,
      })
      const args = decoded.args as {
        listingId: bigint | number
        listingType: number
        startTime: bigint | number
        endTime: bigint | number
        initialAmount: bigint
        erc20: Address
      }
      const listingId =
        typeof args.listingId === 'bigint' ? args.listingId : BigInt(args.listingId)
      await upsertListing({
        chain_id: cfg.id,
        listing_id: listingId.toString(),
        listing_type: Number(args.listingType),
        seller: null,
        token_address: null,
        token_id: null,
        erc20: args.erc20?.toLowerCase() ?? null,
        start_time: BigInt(args.startTime).toString(),
        end_time: BigInt(args.endTime).toString(),
        initial_amount: args.initialAmount.toString(),
        created_block: (log.blockNumber ?? 0n).toString(),
      })
    } catch {
      /* skip */
    }
  }

  await setCursor(cfg.id, CURSOR_MARKETPLACE, to)
  return { listings: logs.length, toBlock: to }
}

async function refreshRecentAuctions(chainId: number, limit = 24) {
  const marketplace = getMarketplaceAddress(chainId)
  const client = getPublicClient(chainId)
  const ids = await listAuctionListingIds(chainId, limit)
  for (const id of ids) {
    try {
      const listing = (await client.readContract({
        address: marketplace,
        abi: MARKETPLACE_ABI,
        functionName: 'getListing',
        args: [Number(id)],
      })) as unknown as ContractListing
      await refreshListingState(chainId, id, {
        finalized: listing.finalized,
        current_bid_amount: listing.bid.amount > 0n ? listing.bid.amount.toString() : null,
        current_bidder:
          listing.bid.amount > 0n ? listing.bid.bidder.toLowerCase() : null,
      })
    } catch (e) {
      console.warn('[indexer] refresh listing', id, e)
    }
  }
}

export interface SyncResult {
  ok: boolean
  chains: Record<string, unknown>
  error?: string
}

export async function runIndexerSync(opts?: { skipSchema?: boolean }): Promise<SyncResult> {
  if (!hasDatabase()) {
    return { ok: false, chains: {}, error: 'DATABASE_URL not configured' }
  }

  if (!opts?.skipSchema) {
    await ensureSchema()
  }

  const chains: Record<string, unknown> = {}

  for (const cfg of getIndexerChainConfigs()) {
    const poolResult = await syncFactoryPools(cfg)
    const eventResult = await syncPairEvents(cfg)
    chains[`${cfg.id}`] = { pools: poolResult, pairEvents: eventResult }
  }

  for (const cfg of getMarketplaceChainConfigs()) {
    const listingResult = await syncMarketplaceListings(cfg)
    await refreshRecentAuctions(cfg.id)
    chains[`m-${cfg.id}`] = { listings: listingResult }
  }

  return { ok: true, chains }
}

/** RPC fallback path without DB — thin wrapper for scripts. */
export async function backfillPoolsViaRpc(chainId: number, lookbackBlocks?: bigint) {
  return discoverPools({ chainId, lookbackBlocks })
}