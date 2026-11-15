import { describe, expect, it } from 'vitest'
import { isAuctionHouseEnabled } from './chain-config'

describe('isAuctionHouseEnabled', () => {
  it('enables auctions on Base mainnet (default marketplace configured)', () => {
    expect(isAuctionHouseEnabled(8453)).toBe(true)
  })

  it('hides auctions on Base Sepolia until NEXT_PUBLIC_MARKETPLACE_ADDRESS_84532 is set', () => {
    expect(isAuctionHouseEnabled(84532)).toBe(false)
  })
})