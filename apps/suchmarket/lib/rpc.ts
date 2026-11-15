import { createPublicClient, http } from 'viem'
import { getChainConfig } from './chain-config'
import { isSupportedChainId } from './chains'

/** Server- and client-safe public client (no 'use client'). */
export function getPublicClient(chainId: number) {
  if (!isSupportedChainId(chainId)) {
    throw new Error(`Unsupported chain: ${chainId}`)
  }
  const cfg = getChainConfig(chainId)
  if (!cfg) throw new Error(`No RPC config for chain ${chainId}`)
  return createPublicClient({
    chain: cfg.viemChain,
    transport: http(cfg.rpcUrl),
  })
}
