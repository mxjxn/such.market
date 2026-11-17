import { Address, getAddress, isAddress } from 'viem'

export type CollectionVerificationSource = 'studio_auto' | 'admin_curated' | 'unverified'

export type CollectionVerification = {
  verified: boolean
  source: CollectionVerificationSource
}

/**
 * Optional allowlist via `NEXT_PUBLIC_VERIFIED_COLLECTIONS` — comma-separated
 * `chainId:0xcontract` entries (e.g. `8453:0xabc...,1:0xdef...`).
 */
function parseVerifiedAllowlist(): Map<string, CollectionVerificationSource> {
  const raw = process.env.NEXT_PUBLIC_VERIFIED_COLLECTIONS?.trim()
  if (!raw) return new Map()

  const map = new Map<string, CollectionVerificationSource>()
  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const [chainPart, addrPart] = trimmed.split(':')
    const chainId = Number(chainPart)
    if (!Number.isFinite(chainId) || !addrPart || !isAddress(addrPart)) continue
    try {
      const key = `${chainId}:${getAddress(addrPart).toLowerCase()}`
      map.set(key, 'admin_curated')
    } catch {
      /* skip malformed */
    }
  }
  return map
}

let cachedAllowlist: Map<string, CollectionVerificationSource> | null = null

function allowlist(): Map<string, CollectionVerificationSource> {
  if (!cachedAllowlist) cachedAllowlist = parseVerifiedAllowlist()
  return cachedAllowlist
}

export function getCollectionVerification(chainId: number, contract: Address): CollectionVerification {
  const key = `${chainId}:${contract.toLowerCase()}`
  const source = allowlist().get(key)
  if (source) {
    return { verified: true, source }
  }
  return { verified: false, source: 'unverified' }
}