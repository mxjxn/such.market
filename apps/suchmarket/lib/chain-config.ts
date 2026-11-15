import { Address } from 'viem'
import { base, baseSepolia, mainnet, type Chain } from 'viem/chains'
import { CONFIG } from './config'
import { getFactoryAddress as getFactoryFromAbis, getRouterAddress as getRouterFromAbis } from '@mxjxn/lssvm-abis'

export interface ChainRuntimeConfig {
  id: number
  name: string
  viemChain: Chain
  rpcUrl: string
  factoryAddress: Address | null
  routerAddress: Address | null
  marketplaceAddress: Address | null
  /** First block to scan for factory pool-creation logs (override via env). */
  factoryStartBlock: bigint
  /** First block to scan for marketplace listing logs (override via env). */
  marketplaceStartBlock: bigint
}

const ZERO = '0x0000000000000000000000000000000000000000' as Address

function envAddr(key: string): Address | null {
  const v = process.env[key]?.trim()
  if (!v || v === ZERO) return null
  return v as Address
}

function envBigint(key: string, fallback: bigint): bigint {
  const v = process.env[key]?.trim()
  if (!v) return fallback
  try {
    return BigInt(v)
  } catch {
    return fallback
  }
}

function resolveFactory(chainId: number): Address | null {
  if (chainId === 8453) return (CONFIG.FACTORY_ADDRESS_8453 as Address) || envAddr(`NEXT_PUBLIC_FACTORY_ADDRESS_${chainId}`)
  if (chainId === 84532) return (CONFIG.FACTORY_ADDRESS_84532 as Address) || envAddr(`NEXT_PUBLIC_FACTORY_ADDRESS_${chainId}`)
  if (chainId === 1) {
    const fromEnv = envAddr(`NEXT_PUBLIC_FACTORY_ADDRESS_${chainId}`)
    const configured = (CONFIG.FACTORY_ADDRESS_1 as string)?.trim()
    return fromEnv ?? (configured ? (configured as Address) : null)
  }
  const fromEnv = envAddr(`NEXT_PUBLIC_FACTORY_ADDRESS_${chainId}`)
  if (fromEnv) return fromEnv
  try {
    return getFactoryFromAbis(chainId)
  } catch {
    return null
  }
}

function resolveRouter(chainId: number): Address | null {
  if (chainId === 8453) return (CONFIG.ROUTER_ADDRESS_8453 as Address) || envAddr(`NEXT_PUBLIC_ROUTER_ADDRESS_${chainId}`)
  if (chainId === 84532) return (CONFIG.ROUTER_ADDRESS_84532 as Address) || envAddr(`NEXT_PUBLIC_ROUTER_ADDRESS_${chainId}`)
  if (chainId === 1) {
    const fromEnv = envAddr(`NEXT_PUBLIC_ROUTER_ADDRESS_${chainId}`)
    const configured = (CONFIG.ROUTER_ADDRESS_1 as string)?.trim()
    return fromEnv ?? (configured ? (configured as Address) : null)
  }
  const fromEnv = envAddr(`NEXT_PUBLIC_ROUTER_ADDRESS_${chainId}`)
  if (fromEnv) return fromEnv
  try {
    return getRouterFromAbis(chainId)
  } catch {
    return null
  }
}

const DEFAULT_MARKETPLACE: Partial<Record<number, Address>> = {
  8453: '0x1Cb0c1F72Ba7547fC99c4b5333d8aBA1eD6b31A9',
  1: '0x3CEE515879FFe4620a1F8aC9bf09B97e858815Ef',
}

function resolveMarketplace(chainId: number): Address | null {
  if (chainId === 1) {
    return (
      envAddr('NEXT_PUBLIC_MARKETPLACE_ADDRESS_1') ??
      envAddr('NEXT_PUBLIC_MARKETPLACE_ADDRESS_ETHEREUM') ??
      DEFAULT_MARKETPLACE[1] ??
      null
    )
  }
  if (chainId === 8453) {
    return (
      envAddr('NEXT_PUBLIC_MARKETPLACE_ADDRESS_8453') ??
      envAddr('NEXT_PUBLIC_MARKETPLACE_ADDRESS') ??
      DEFAULT_MARKETPLACE[8453] ??
      null
    )
  }
  return envAddr(`NEXT_PUBLIC_MARKETPLACE_ADDRESS_${chainId}`)
}

const DEFAULT_FACTORY_START: Record<number, bigint> = {
  8453: 38_239_761n,
  84532: 18_000_000n,
  1: 19_000_000n, // override via INDEXER_FACTORY_START_BLOCK_1
}

const DEFAULT_MARKETPLACE_START: Record<number, bigint> = {
  8453: 38_000_000n,
  84532: 18_000_000n,
  1: 19_000_000n,
}

function buildChain(
  id: number,
  name: string,
  viemChain: Chain,
  rpcUrl: string
): ChainRuntimeConfig {
  const factory = resolveFactory(id)
  const router = resolveRouter(id)
  const marketplace = resolveMarketplace(id)
  return {
    id,
    name,
    viemChain,
    rpcUrl,
    factoryAddress: factory,
    routerAddress: router,
    marketplaceAddress: marketplace,
    factoryStartBlock: envBigint(`INDEXER_FACTORY_START_BLOCK_${id}`, DEFAULT_FACTORY_START[id] ?? 0n),
    marketplaceStartBlock: envBigint(
      `INDEXER_MARKETPLACE_START_BLOCK_${id}`,
      DEFAULT_MARKETPLACE_START[id] ?? DEFAULT_FACTORY_START[id] ?? 0n
    ),
  }
}

/** Ordered list of chains such.market knows about (may be partially configured). */
export const ALL_CHAIN_CONFIGS: ChainRuntimeConfig[] = [
  buildChain(8453, 'Base', base, CONFIG.BASE_RPC_URL),
  buildChain(84532, 'Base Sepolia', baseSepolia, CONFIG.BASE_SEPOLIA_RPC_URL),
  buildChain(
    1,
    'Ethereum',
    mainnet,
    process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || 'https://ethereum.publicnode.com'
  ),
]

/** Chains with a factory address — pool discovery / indexer. */
export function getIndexerChainConfigs(): ChainRuntimeConfig[] {
  return ALL_CHAIN_CONFIGS.filter((c) => c.factoryAddress)
}

/** Chains with marketplace — auction house reads. */
export function getMarketplaceChainConfigs(): ChainRuntimeConfig[] {
  return ALL_CHAIN_CONFIGS.filter((c) => c.marketplaceAddress)
}

export function getChainConfig(chainId: number): ChainRuntimeConfig | undefined {
  return ALL_CHAIN_CONFIGS.find((c) => c.id === chainId)
}

export function getRpcUrl(chainId: number): string {
  const cfg = getChainConfig(chainId)
  if (!cfg) throw new Error(`Unknown chain ${chainId}`)
  return cfg.rpcUrl
}

/** Max blocks processed per indexer cron tick (env INDEXER_MAX_BLOCKS_PER_RUN, default 250_000). */
export function getIndexerMaxBlocksPerRun(): bigint {
  return envBigint('INDEXER_MAX_BLOCKS_PER_RUN', 250_000n)
}

/** Log chunk size for eth_getLogs (env INDEXER_LOG_CHUNK, default 50_000). */
export function getIndexerLogChunk(): bigint {
  return envBigint('INDEXER_LOG_CHUNK', 50_000n)
}