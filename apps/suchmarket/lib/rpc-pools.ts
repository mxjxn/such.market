import {
  Address,
  Log,
  decodeEventLog,
  getAddress,
  parseAbiItem,
} from 'viem'
import { getPublicClient } from './rpc'
import { getFactoryAddress, LSSVM_PAIR_ABI } from './contracts'
import { getCurveType, isSupportedChainId } from './chains'
import { getChainConfig, getIndexerLogChunk } from './chain-config'

const NEW_ERC721_PAIR = parseAbiItem(
  'event NewERC721Pair(address indexed poolAddress, uint256[] initialIds)'
)
const NEW_ERC1155_PAIR = parseAbiItem(
  'event NewERC1155Pair(address indexed poolAddress, uint256 initialBalance)'
)

export interface IndexedPool {
  poolAddress: Address
  nft: Address
  poolType: number
  spotPrice: bigint
  delta: bigint
  fee: bigint
  bondingCurve: Address
  curveType: string
  token: Address | null
  owner: Address | null
  pairVariant: number | null
  nftId: bigint | null
  createdBlock: bigint
}

const PAIR_OWNER_ABI = [
  {
    inputs: [],
    name: 'owner',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

async function getLogsChunked(
  chainId: number,
  factory: Address,
  event: typeof NEW_ERC721_PAIR | typeof NEW_ERC1155_PAIR,
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
      const slice = await client.getLogs({
        address: factory,
        event,
        fromBlock: start,
        toBlock: end,
      })
      logs.push(...slice)
    } catch (error) {
      console.warn(`getLogs failed ${start}-${end}:`, error)
      await new Promise((r) => setTimeout(r, 250))
    }
    start = end + 1n
  }
  return logs
}

export async function enrichPoolOnly(
  chainId: number,
  poolAddress: Address,
  createdBlock: bigint
): Promise<IndexedPool | null> {
  const client = getPublicClient(chainId)
  try {
    const [poolType, spotPrice, delta, fee, nft, bondingCurve] = await Promise.all([
      client.readContract({ address: poolAddress, abi: LSSVM_PAIR_ABI, functionName: 'poolType' }),
      client.readContract({ address: poolAddress, abi: LSSVM_PAIR_ABI, functionName: 'spotPrice' }),
      client.readContract({ address: poolAddress, abi: LSSVM_PAIR_ABI, functionName: 'delta' }),
      client.readContract({ address: poolAddress, abi: LSSVM_PAIR_ABI, functionName: 'fee' }),
      client.readContract({ address: poolAddress, abi: LSSVM_PAIR_ABI, functionName: 'nft' }),
      client.readContract({
        address: poolAddress,
        abi: LSSVM_PAIR_ABI,
        functionName: 'bondingCurve',
      }),
    ])

    let token: Address | null = null
    try {
      token = (await client.readContract({
        address: poolAddress,
        abi: LSSVM_PAIR_ABI,
        functionName: 'token',
      })) as Address
    } catch {
      token = null
    }

    let owner: Address | null = null
    try {
      owner = (await client.readContract({
        address: poolAddress,
        abi: PAIR_OWNER_ABI,
        functionName: 'owner',
      })) as Address
    } catch {
      owner = null
    }

    let pairVariant: number | null = null
    let nftId: bigint | null = null
    try {
      pairVariant = (await client.readContract({
        address: poolAddress,
        abi: LSSVM_PAIR_ABI,
        functionName: 'pairVariant',
      })) as number
      if (pairVariant === 2 || pairVariant === 3) {
        nftId = (await client.readContract({
          address: poolAddress,
          abi: LSSVM_PAIR_ABI,
          functionName: 'nftId',
        })) as bigint
      }
    } catch {
      // ignore
    }

    const bonding = bondingCurve as Address
    return {
      poolAddress: getAddress(poolAddress),
      nft: getAddress(nft as Address),
      poolType: poolType as number,
      spotPrice: spotPrice as bigint,
      delta: delta as bigint,
      fee: fee as bigint,
      bondingCurve: bonding,
      curveType: getCurveType(chainId, bonding),
      token,
      owner,
      pairVariant,
      nftId,
      createdBlock,
    }
  } catch (error) {
    console.warn('Failed to enrich pool', poolAddress, error)
    return null
  }
}

function factoryStartBlock(chainId: number): bigint {
  return getChainConfig(chainId)?.factoryStartBlock ?? 0n
}

export async function discoverPools(options: {
  chainId: number
  nftContract?: Address
  owner?: Address
  lookbackBlocks?: bigint
}): Promise<IndexedPool[]> {
  const { chainId, nftContract, owner } = options
  if (!isSupportedChainId(chainId)) {
    throw new Error(`Unsupported chain ${chainId}`)
  }

  const client = getPublicClient(chainId)
  const factory = getFactoryAddress(chainId)
  const latest = await client.getBlockNumber()
  const startDefault = factoryStartBlock(chainId)
  const fromBlock = options.lookbackBlocks
    ? latest > options.lookbackBlocks
      ? latest - options.lookbackBlocks
      : 0n
    : startDefault

  const [erc721Logs, erc1155Logs] = await Promise.all([
    getLogsChunked(chainId, factory, NEW_ERC721_PAIR, fromBlock, latest),
    getLogsChunked(chainId, factory, NEW_ERC1155_PAIR, fromBlock, latest),
  ])

  const addresses = new Map<string, bigint>()
  for (const log of [...erc721Logs, ...erc1155Logs]) {
    try {
      const decoded = decodeEventLog({
        abi: [NEW_ERC721_PAIR, NEW_ERC1155_PAIR],
        data: log.data,
        topics: log.topics,
      })
      const poolAddress = (decoded.args as { poolAddress: Address }).poolAddress
      if (poolAddress) {
        addresses.set(getAddress(poolAddress).toLowerCase(), log.blockNumber ?? 0n)
      }
    } catch {
      // skip malformed
    }
  }

  const pools: IndexedPool[] = []
  const entries = [...addresses.entries()]
  const BATCH = 8
  for (let i = 0; i < entries.length; i += BATCH) {
    const slice = entries.slice(i, i + BATCH)
    const enriched = await Promise.all(
      slice.map(([addr, block]) => enrichPoolOnly(chainId, getAddress(addr), block))
    )
    for (const pool of enriched) {
      if (!pool) continue
      if (nftContract && pool.nft.toLowerCase() !== nftContract.toLowerCase()) continue
      if (owner && (!pool.owner || pool.owner.toLowerCase() !== owner.toLowerCase())) continue
      pools.push(pool)
    }
  }

  return pools.sort((a, b) => (a.spotPrice < b.spotPrice ? -1 : 1))
}

export async function getPoolByAddress(
  chainId: number,
  poolAddress: Address
): Promise<IndexedPool | null> {
  return enrichPoolOnly(chainId, getAddress(poolAddress), 0n)
}