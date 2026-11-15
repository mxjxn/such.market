import { describe, expect, it } from 'vitest'
import {
  allowAuctionRpcDiscovery,
  getAuctionBrowseStatus,
  AUCTION_INDEXER_NOT_CONFIGURED_MESSAGE,
} from './auction-indexer'

describe('auction indexer policy', () => {
  it('blocks production auction browse without DATABASE_URL', () => {
    expect(
      getAuctionBrowseStatus(8453, { nodeEnv: 'production', databaseConfigured: false })
    ).toBe('indexer_not_configured')
    expect(allowAuctionRpcDiscovery('production')).toBe(false)
    expect(AUCTION_INDEXER_NOT_CONFIGURED_MESSAGE).toMatch(/DATABASE_URL/)
  })

  it('allows dev auction browse without DATABASE_URL (RPC fallback)', () => {
    expect(
      getAuctionBrowseStatus(8453, { nodeEnv: 'development', databaseConfigured: false })
    ).toBe('ready')
    expect(allowAuctionRpcDiscovery('development')).toBe(true)
  })

  it('treats Base Sepolia as marketplace-not-configured by default', () => {
    expect(getAuctionBrowseStatus(84532, { nodeEnv: 'development' })).toBe(
      'marketplace_not_configured'
    )
  })
})