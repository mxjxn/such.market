'use client'

import { useQuery } from '@tanstack/react-query'
import { useAppChain } from '@/contexts/ChainContext'
import { getChainName, getEnabledChainIds } from '@/lib/chains'
import { AuctionCard } from '@/components/auctions/AuctionCard'
import type { AuctionSummary } from '@/lib/auctions-server'
import Link from 'next/link'

async function loadAuctions(chainId: number): Promise<AuctionSummary[]> {
  const res = await fetch(`/api/auctions?chainId=${chainId}&limit=24`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to load auctions')
  }
  const data = await res.json()
  return data.auctions as AuctionSummary[]
}

export default function AuctionsPage() {
  const { chainId, setChainId } = useAppChain()
  const enabled = getEnabledChainIds()

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['auctions', chainId],
    queryFn: () => loadAuctions(chainId),
    staleTime: 30_000,
  })

  return (
    <div className="sm-band-sky min-h-full">
      <div className="sm-container py-10 md:py-14">
        <header className="max-w-2xl mb-8">
          <h1 className="sm-heading text-3xl md:text-4xl">Auctions</h1>
          <p className="mt-2 text-mute text-sm leading-relaxed">
            Live English auctions on the cryptoart marketplace contract — bids settle on-chain.
            List new lots in{' '}
            <a
              href="https://cryptoart.studio"
              className="text-sky-deep hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              studio
            </a>
            .
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-3 mb-8">
          <label className="text-sm text-mute">Network</label>
          <select
            className="sm-input w-auto text-sm"
            value={chainId}
            onChange={(e) => setChainId(parseInt(e.target.value, 10) as typeof chainId)}
          >
            {enabled.map((id) => (
              <option key={id} value={id}>
                {getChainName(id)}
              </option>
            ))}
          </select>
          <button type="button" className="sm-btn-secondary text-sm" onClick={() => refetch()}>
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {isLoading && <p className="text-sm text-mute">Loading live auctions…</p>}
        {error && (
          <p className="text-sm text-clay">
            {error instanceof Error ? error.message : 'Could not load auctions'}
          </p>
        )}

        {data && data.length === 0 && !isLoading && (
          <div className="sm-card p-8 text-center max-w-lg">
            <p className="sm-heading text-xl">No active auctions on {getChainName(chainId)}</p>
            <p className="mt-2 text-sm text-mute">
              When listings exist, they appear here. Ensure{' '}
              <code className="text-xs">NEXT_PUBLIC_MARKETPLACE_ADDRESS_{chainId}</code> and indexer
              cron are configured.
            </p>
            <Link href="/explore" className="sm-btn-primary inline-flex mt-6">
              Explore pools
            </Link>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data?.map((a) => (
            <AuctionCard key={`${a.chainId}-${a.listingId}`} auction={a} />
          ))}
        </div>
      </div>
    </div>
  )
}