'use client'

import { useState } from 'react'
import { formatEther, parseEther } from 'viem'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { MARKETPLACE_ABI, getMarketplaceAddress, type ContractListing } from '@/lib/marketplace'
import { TransactionStatus } from '@/components/TransactionStatus'

export function AuctionBidPanel({
  chainId,
  listingId,
  listing,
}: {
  chainId: number
  listingId: bigint
  listing: ContractListing
}) {
  const { address } = useAccount()
  const [customBid, setCustomBid] = useState('')
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const minBid =
    listing.bid.amount > 0n
      ? listing.bid.amount +
        (listing.bid.amount * BigInt(listing.details.minIncrementBPS)) / 10000n
      : listing.details.initialAmount

  const placeBid = (value: bigint) => {
    if (!address) return
    writeContract({
      address: getMarketplaceAddress(chainId),
      abi: MARKETPLACE_ABI,
      functionName: 'bid',
      args: [Number(listingId), false],
      value,
    })
  }

  return (
    <div className="sm-card p-5 space-y-4">
      <MotionBlock listing={listing} minBid={minBid} />
      <button
        type="button"
        className="sm-btn-primary w-full"
        disabled={!address || isPending || confirming || listing.finalized}
        onClick={() => placeBid(minBid)}
      >
        {!address ? 'Connect wallet' : isPending || confirming ? 'Confirm in wallet…' : `Bid ${formatEther(minBid)} ETH`}
      </button>
      <div>
        <label className="sm-label">Custom bid (ETH)</label>
        <div className="flex gap-2">
          <input
            className="sm-input flex-1"
            value={customBid}
            onChange={(e) => setCustomBid(e.target.value)}
            placeholder={formatEther(minBid)}
          />
          <button
            type="button"
            className="sm-btn-secondary shrink-0"
            disabled={!address || !customBid || isPending || confirming}
            onClick={() => {
              try {
                placeBid(parseEther(customBid))
              } catch {
                alert('Invalid amount')
              }
            }}
          >
            Bid
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-clay">{error.message}</p>}
      {hash && (
        <TransactionStatus
          status={
            isPending || confirming ? 'pending' : isSuccess ? 'success' : error ? 'error' : 'pending'
          }
          hash={hash}
          error={error ?? undefined}
        />
      )}
    </div>
  )
}

function MotionBlock({ listing, minBid }: { listing: ContractListing; minBid: bigint }) {
  return (
    <div className="text-sm space-y-2">
      <div className="flex justify-between">
        <span className="text-mute">Reserve</span>
        <span className="font-mono">{formatEther(listing.details.initialAmount)} ETH</span>
      </div>
      <div className="flex justify-between">
        <span className="text-mute">Current bid</span>
        <span className="font-mono">
          {listing.bid.amount > 0n ? `${formatEther(listing.bid.amount)} ETH` : '—'}
        </span>
      </div>
      <div className="flex justify-between border-t border-line pt-2">
        <span className="text-mute">Next min bid</span>
        <span className="font-mono font-medium">{formatEther(minBid)} ETH</span>
      </div>
    </div>
  )
}