'use client'

import Link from 'next/link'
import type { AuctionSummary } from '@/lib/auctions-server'

function formatEnds(endsAt: number): string {
  if (!endsAt) return 'Open'
  const now = Math.floor(Date.now() / 1000)
  const left = endsAt - now
  if (left <= 0) return 'Ended'
  const h = Math.floor(left / 3600)
  const m = Math.floor((left % 3600) / 60)
  if (h > 48) return `${Math.floor(h / 24)}d`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function AuctionCard({ auction }: { auction: AuctionSummary }) {
  const href = `/auctions/${auction.chainId}/${auction.listingId}`
  return (
    <Link href={href} className="sm-card block p-4 hover:shadow-play transition">
      <div className="flex gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-line bg-mist">
          {auction.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={auction.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full grid place-items-center text-xs text-soft">NFT</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="sm-heading text-lg text-ink truncate">
            {auction.title || `Lot #${auction.listingId}`}
          </p>
          <p className="text-xs text-soft font-mono mt-0.5 truncate">
            {auction.tokenAddress.slice(0, 8)}… #{auction.tokenId}
          </p>
          <div className="mt-2 flex items-baseline justify-between gap-2 text-sm">
            <span className="text-mute">
              {auction.hasBid ? 'High bid' : 'Reserve'}{' '}
              <span className="text-ink font-semibold tabular-nums">
                {auction.hasBid ? auction.currentBid : auction.reserve} ETH
              </span>
            </span>
            <span className="text-xs text-soft">{formatEnds(auction.endsAt)} left</span>
          </div>
        </div>
      </div>
    </Link>
  )
}