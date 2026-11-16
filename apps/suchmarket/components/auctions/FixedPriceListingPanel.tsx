'use client'

import { formatEther } from 'viem'
import type { ContractListing } from '@/lib/marketplace'

export function FixedPriceListingPanel({ listing }: { listing: ContractListing }) {
  const isEth = listing.details.erc20 === '0x0000000000000000000000000000000000000000'
  const priceLabel = isEth
    ? `${formatEther(listing.details.initialAmount)} ETH`
    : `${listing.details.initialAmount.toString()} (ERC-20)`

  return (
    <div className="sm-card p-5 space-y-3">
      <p className="sm-play text-xs uppercase tracking-wider text-soft">Fixed price</p>
      <p className="sm-heading text-2xl tabular-nums">{priceLabel}</p>
      <p className="text-sm text-mute">
        {listing.details.totalAvailable - listing.totalSold} of {listing.details.totalAvailable} available ·{' '}
        {listing.details.totalPerSale} per purchase
      </p>
      <p className="text-xs text-mute">
        Purchase from the marketplace contract in your wallet (buy UI coming soon on such.market).
      </p>
    </div>
  )
}