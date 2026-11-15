'use client'

import { useQuery } from '@tanstack/react-query'
import { useAppChain } from '@/contexts/ChainContext'
import { getChainName, getEnabledChainIds } from '@/lib/chains'
import { getMarketplaceChainConfigs, isAuctionHouseEnabled } from '@/lib/chain-config'
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
  const auctionChains = getMarketplaceChainConfigs().map((c) => c.id)
  const chainHasAuctions = isAuctionHouseEnabled(chainId)

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['auctions', chainId],
    queryFn: () => loadAuctions(chainId),
    staleTime: 30_000,
    enabled: chainHasAuctions,
  })

  if (auctionChains.length === 0) {
    return (
      <div className="sm-band-sky min-h-full">
        <div className="sm-container py-10 md:py-14 max-w-lg">
          <h1 className="sm-heading text-3xl md:text-4xl">Auctions</h1>
          <p className="mt-4 text-sm text-mute leading-relaxed">
            No auction house is configured yet. Set{' '}
            <code className="text-xs">NEXT_PUBLIC_MARKETPLACE_ADDRESS_*</code> for a supported chain to
            enable this section.
          </p>
          <Link href="/explore" className="sm-btn-primary inline-flex mt-6">
            Explore pools
          </Link>
        </div>
      </div>
    )
  }

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

        {!chainHasAuctions && (
          <div className="sm-card p-8 text-center max-w-lg mb-8">
            <p className="sm-heading text-xl">Auctions not on {getChainName(chainId)} yet</p>
            <p className="mt-2 text-sm text-mute leading-relaxed">
              Base Sepolia stays pool-only until a testnet marketplace contract is deployed and{' '}
              <code className="text-xs">NEXT_PUBLIC_MARKETPLACE_ADDRESS_84532</code> is set. Switch to a
              network with an auction house below.
            </p>
          </div>
        )}

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
                {!isAuctionHouseEnabled(id) ? ' (pools only)' : ''}
              </option>
            ))}
          </select>
          <button type="button" className="sm-btn-secondary text-sm" onClick={() => refetch()}>
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {chainHasAuctions && isLoading && (
          <p className="text-sm text-mute">Loading live auctions…</p>
        )}
        {error && (
          <p className="text-sm text-clay">
            {error instanceof Error ? error.message : 'Could not load auctions'}
          </p>
        )}

        {chainHasAuctions && data && data.length === 0 && !isLoading && (
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
          {chainHasAuctions &&
            data?.map((a) => (
            <AuctionCard key={`${a.chainId}-${a.listingId}`} auction={a} />
          ))}
        </div>
      </div>
    </div>
  )
}