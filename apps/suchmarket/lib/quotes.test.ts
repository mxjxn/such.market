import { describe, expect, it } from 'vitest'
import {
  applySlippageBuy,
  applySlippageSell,
  buildBuyBreakdown,
  buildSellBreakdown,
  explainLinearCurve,
  formatEth,
  formatFeeBps,
} from './quotes'

describe('slippage', () => {
  it('increases buy max by bps', () => {
    expect(applySlippageBuy(1_000_000n, 100)).toBe(1_010_000n) // 1%
  })

  it('decreases sell min by bps', () => {
    expect(applySlippageSell(1_000_000n, 100)).toBe(990_000n)
  })
})

/** Values from `SuchmarketBaseSepoliaForkTest.test_erc721_erc20_pool_quoteAndFees` (Base Sepolia fork). */
const FORK_ERC721_ERC20_BUY = {
  inputAmount: 2_163_000_000_000_000n,
  protocolFee: 42_000_000_000_000n,
  royaltyAmount: 0n,
} as const

/** Values from `SuchmarketBaseSepoliaForkTest.test_exponential_pool_sellBack_viaRouter` (sell quote). */
const FORK_EXP_SELL = {
  outputAmount: 2_037_000_000_000_000n,
  protocolFee: 42_000_000_000_000n,
  royaltyAmount: 0n,
} as const

describe('breakdowns', () => {
  it('matches Base Sepolia fork buy quote decomposition (ERC721/ERC20 pool)', () => {
    const b = buildBuyBreakdown(
      FORK_ERC721_ERC20_BUY.inputAmount,
      FORK_ERC721_ERC20_BUY.protocolFee,
      FORK_ERC721_ERC20_BUY.royaltyAmount,
      0
    )
    expect(b.total).toBe(FORK_ERC721_ERC20_BUY.inputAmount)
    expect(b.protocolFee).toBe(FORK_ERC721_ERC20_BUY.protocolFee)
    expect(b.royaltyAmount).toBe(0n)
    expect(b.poolComponent).toBe(
      FORK_ERC721_ERC20_BUY.inputAmount -
        FORK_ERC721_ERC20_BUY.protocolFee -
        FORK_ERC721_ERC20_BUY.royaltyAmount
    )
  })

  it('matches Base Sepolia fork sell quote decomposition (exponential ETH pool)', () => {
    const b = buildSellBreakdown(
      FORK_EXP_SELL.outputAmount,
      FORK_EXP_SELL.protocolFee,
      FORK_EXP_SELL.royaltyAmount,
      0
    )
    expect(b.total).toBe(FORK_EXP_SELL.outputAmount)
    expect(b.protocolFee + b.royaltyAmount + b.total).toBe(b.poolComponent)
  })

  it('builds buy breakdown with fees', () => {
    const b = buildBuyBreakdown(1_000_000_000_000_000_000n, 10_000_000_000_000_000n, 5_000_000_000_000_000n, 50)
    expect(b.total).toBe(1_000_000_000_000_000_000n)
    expect(b.protocolFee).toBe(10_000_000_000_000_000n)
    expect(b.royaltyAmount).toBe(5_000_000_000_000_000n)
    expect(b.poolComponent).toBe(985_000_000_000_000_000n)
    expect(b.withSlippage).toBe(applySlippageBuy(b.total, 50))
  })

  it('builds sell breakdown', () => {
    const b = buildSellBreakdown(900_000_000_000_000_000n, 10_000_000_000_000_000n, 5_000_000_000_000_000n, 100)
    expect(b.withSlippage).toBe(applySlippageSell(b.total, 100))
  })
})

describe('formatting', () => {
  it('formats eth without trailing zeros', () => {
    expect(formatEth(1_500_000_000_000_000_000n, 4)).toBe('1.5')
    expect(formatEth(1_000_000_000_000_000_000n, 4)).toBe('1')
  })

  it('formats fee from 1e18 scale', () => {
    // 1% = 0.01e18
    expect(formatFeeBps(10_000_000_000_000_000n)).toBe('1%')
  })
})

describe('plain language', () => {
  it('explains linear curve for artists', () => {
    const text = explainLinearCurve('0.05', '0.001')
    expect(text).toContain('linear')
    expect(text).toContain('0.05')
    expect(text).toContain('0.001')
  })
})
