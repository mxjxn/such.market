import { formatUnits } from 'viem'

/**
 * Pure quote helpers — no RPC. Used by UI and unit tests.
 * LSSVM quotes return wei amounts; fees are absolute amounts included in the quote.
 */

export interface QuoteBreakdown {
  /** Total the buyer pays / seller receives */
  total: bigint
  protocolFee: bigint
  royaltyAmount: bigint
  /** Approximate portion attributable to pool fee + curve (total - protocol - royalty for buys) */
  poolComponent: bigint
  /** Suggested max/min with slippage (bps) */
  withSlippage: bigint
}

export function applySlippageBuy(amount: bigint, slippageBps: number): bigint {
  // Buyer is willing to pay more
  return (amount * BigInt(10_000 + slippageBps)) / 10_000n
}

export function applySlippageSell(amount: bigint, slippageBps: number): bigint {
  // Seller accepts less
  return (amount * BigInt(10_000 - slippageBps)) / 10_000n
}

export function buildBuyBreakdown(
  inputAmount: bigint,
  protocolFee: bigint,
  royaltyAmount: bigint,
  slippageBps: number
): QuoteBreakdown {
  const poolComponent =
    inputAmount > protocolFee + royaltyAmount
      ? inputAmount - protocolFee - royaltyAmount
      : 0n
  return {
    total: inputAmount,
    protocolFee,
    royaltyAmount,
    poolComponent,
    withSlippage: applySlippageBuy(inputAmount, slippageBps),
  }
}

export function buildSellBreakdown(
  outputAmount: bigint,
  protocolFee: bigint,
  royaltyAmount: bigint,
  slippageBps: number
): QuoteBreakdown {
  const poolComponent =
    outputAmount > 0n ? outputAmount + protocolFee + royaltyAmount : 0n
  return {
    total: outputAmount,
    protocolFee,
    royaltyAmount,
    poolComponent,
    withSlippage: applySlippageSell(outputAmount, slippageBps),
  }
}

export function formatEth(amount: bigint, digits = 4): string {
  const raw = formatUnits(amount, 18)
  const [whole, frac = ''] = raw.split('.')
  if (digits === 0) return whole
  const trimmed = frac.slice(0, digits).replace(/0+$/, '')
  return trimmed ? `${whole}.${trimmed}` : whole
}

export function formatFeeBps(fee: bigint): string {
  // LSSVM fees are in 1e18 = 100%
  const bps = Number((fee * 10_000n) / 10n ** 18n)
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`
}

/**
 * Plain-language explanation of a linear bonding curve for non-DeFi artists.
 */
export function explainLinearCurve(spotPriceEth: string, deltaEth: string): string {
  return `This pool uses a linear price curve. The next piece costs about ${spotPriceEth} ETH. After each sale, the price moves by ${deltaEth} ETH — up when someone buys, down when someone sells. That keeps the market open both ways without an auction clock.`
}

export function explainPoolForArtist(poolType: number): string {
  if (poolType === 2) {
    return 'A trade pool always offers a buy price and a sell price. Collectors can purchase from the curve, and they can sell back later. You earn a fee on each swap while your work stays liquid.'
  }
  if (poolType === 1) {
    return 'A sell pool lists your NFTs on a curve. Buyers purchase from the pool; the pool does not buy pieces back.'
  }
  return 'A buy pool holds ETH (or tokens) and offers to purchase NFTs at the curve price. Useful when you want a standing bid for a collection.'
}
