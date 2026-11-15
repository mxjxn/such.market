/**
 * Trader-facing defaults — override in Vercel without redeploying logic.
 * See ENV_VARS.md for documentation.
 */

function parseIntEnv(key: string, fallback: number): number {
  const v = process.env[key]
  if (v === undefined || v === '') return fallback
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}

/** Default pool fee in basis points (Create pool form). */
export const DEFAULT_POOL_FEE_BPS = parseIntEnv('NEXT_PUBLIC_DEFAULT_POOL_FEE_BPS', 100)

/** Default spot price string for new pools (ETH units). */
export const DEFAULT_SPOT_PRICE = process.env.NEXT_PUBLIC_DEFAULT_SPOT_PRICE || '0.002'

/** Default delta string for new pools (ETH units). */
export const DEFAULT_DELTA = process.env.NEXT_PUBLIC_DEFAULT_DELTA || '0.01'

/** Soft max ERC-721 token IDs in one createPair call (gas; UI warns above this). */
export const ERC721_CREATE_MAX_IDS_PER_TX = parseIntEnv('NEXT_PUBLIC_ERC721_CREATE_MAX_IDS_PER_TX', 50)

/** Default trade slippage in bps. */
export const DEFAULT_SLIPPAGE_BPS = parseIntEnv('NEXT_PUBLIC_DEFAULT_SLIPPAGE_BPS', 100)