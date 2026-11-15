/**
 * Read-only verification of deployed LSSVM addresses (Base + Base Sepolia).
 *   pnpm --filter @lssvm/suchmarket exec tsx scripts/verify-lssvm-deployments.ts
 */
import { createPublicClient, http, getAddress, type Address } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { BONDING_CURVES, CONTRACT_ADDRESSES } from '@mxjxn/lssvm-abis'
import { CONFIG } from '../lib/config'
import { getFactoryAddress, getRouterAddress } from '../lib/contracts'

const LSSVM_FACTORY_ABI = [
  {
    inputs: [{ name: '', type: 'address' }],
    name: 'bondingCurveAllowed',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'router', type: 'address' }],
    name: 'routerStatus',
    outputs: [
      { name: 'allowed', type: 'bool' },
      { name: 'wasEverTouched', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'protocolFeeRecipient',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const EXPECTED = {
  8453: {
    factory: '0xF6B4bDF778db19DD5928248DE4C18Ce22E8a5f5e',
    router: '0x4352c72114C4b9c4e1F8C96347F2165EECaDeb5C',
    curves: BONDING_CURVES[8453],
  },
  84532: {
    factory: '0x372990Fd91CF61967325dD5270f50c4192bfb892',
    router: '0x6C9e6BAc4255901EaD3447C07917967E9dBc32d3',
    curves: BONDING_CURVES[84532],
  },
} as const

async function verifyChain(chainId: 8453 | 84532) {
  const chain = chainId === 8453 ? base : baseSepolia
  const rpc =
    chainId === 8453 ? CONFIG.BASE_RPC_URL : CONFIG.BASE_SEPOLIA_RPC_URL
  const client = createPublicClient({ chain, transport: http(rpc) })

  const exp = EXPECTED[chainId]
  const pkgFactory = CONTRACT_ADDRESSES[chainId].FACTORY
  const pkgRouter = CONTRACT_ADDRESSES[chainId].ROUTER
  const appFactory = getFactoryAddress(chainId)
  const appRouter = getRouterAddress(chainId)

  const code = await client.getBytecode({ address: exp.factory as Address })
  const live = Boolean(code && code.length > 2)

  const results: Record<string, unknown> = {
    chainId,
    factoryBytecode: live,
    addressMatch: {
      deploymentDoc: exp,
      lssvmAbis: { factory: pkgFactory, router: pkgRouter },
      suchmarket: { factory: appFactory, router: appRouter },
      allMatch:
        getAddress(pkgFactory) === getAddress(exp.factory) &&
        getAddress(pkgRouter) === getAddress(exp.router) &&
        getAddress(appFactory) === getAddress(exp.factory) &&
        getAddress(appRouter) === getAddress(exp.router),
    },
  }

  if (!live) return { ...results, ok: false, error: 'Factory has no bytecode' }

  const [routerStatus, protocolFeeRecipient] = await Promise.all([
    client.readContract({
      address: exp.factory as Address,
      abi: LSSVM_FACTORY_ABI,
      functionName: 'routerStatus',
      args: [exp.router as Address],
    }),
    client.readContract({
      address: exp.factory as Address,
      abi: LSSVM_FACTORY_ABI,
      functionName: 'protocolFeeRecipient',
    }),
  ])

  const curves: Record<string, boolean> = {}
  for (const [name, addr] of Object.entries(exp.curves)) {
    curves[name] = (await client.readContract({
      address: exp.factory as Address,
      abi: LSSVM_FACTORY_ABI,
      functionName: 'bondingCurveAllowed',
      args: [addr as Address],
    })) as boolean
  }

  results.routerWhitelisted = routerStatus[0]
  results.protocolFeeRecipient = protocolFeeRecipient
  results.curvesWhitelisted = curves
  results.ok =
    results.addressMatch &&
    (results.addressMatch as { allMatch: boolean }).allMatch &&
    routerStatus[0] &&
    Object.values(curves).every(Boolean)

  return results
}

async function main() {
  const sepolia = await verifyChain(84532)
  const mainnet = await verifyChain(8453)
  const payload = { sepolia, mainnet, checkedAt: new Date().toISOString() }
  console.log(JSON.stringify(payload, null, 2))
  if (!sepolia.ok || !mainnet.ok) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})