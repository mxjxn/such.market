import { hasDatabase } from '@/indexer/db'
import { isAuctionHouseEnabled } from './chain-config'

export const AUCTION_INDEXER_NOT_CONFIGURED_MESSAGE =
  'Auction indexer not configured. Production browsing requires DATABASE_URL (Vercel Postgres) and the indexer cron.'

export type AuctionBrowseStatus =
  | 'ready'
  | 'marketplace_not_configured'
  | 'indexer_not_configured'

/** Whether auction listing discovery may use on-chain CreateListing log scans (dev/local only). */
export function allowAuctionRpcDiscovery(
  nodeEnv: string | undefined = process.env.NODE_ENV
): boolean {
  return nodeEnv !== 'production'
}

export function getAuctionBrowseStatus(
  chainId: number,
  opts?: { nodeEnv?: string; databaseConfigured?: boolean }
): AuctionBrowseStatus {
  const nodeEnv = opts?.nodeEnv ?? process.env.NODE_ENV
  const databaseConfigured = opts?.databaseConfigured ?? hasDatabase()
  if (!isAuctionHouseEnabled(chainId)) return 'marketplace_not_configured'
  if (nodeEnv === 'production' && !databaseConfigured) {
    return 'indexer_not_configured'
  }
  return 'ready'
}