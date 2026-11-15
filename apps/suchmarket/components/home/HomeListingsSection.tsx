'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useAppChain } from '@/contexts/ChainContext'
import { SAMPLE_AUCTIONS, type SampleAuction } from '@/lib/homeFixtures'
import type { AuctionSummary } from '@/lib/auctions-server'

function AuctionCard({ auction, sample }: { auction: SampleAuction; sample?: boolean }) {
  const inner = (
    <div className="relative flex gap-3 border-b-2 border-line/60 last:border-0 py-4 first:pt-0 last:pb-0">
      {auction.imageUrl && (
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 border-line bg-mist">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={auction.imageUrl} alt="" className="h-full w-full object-cover" />
          {sample && (
            <span className="sm-badge-sample absolute -left-1 -top-1 scale-90">Sample</span>
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-[0.1em] text-soft">{auction.lotLabel}</p>
        <p className="mt-0.5 sm-heading text-lg text-ink leading-snug truncate">{auction.title}</p>
        <div className="mt-1 flex items-baseline justify-between gap-3 text-sm">
          <span className="text-mute">
            Bid <span className="text-ink font-semibold tabular-nums">{auction.currentBid}</span>
          </span>
          <span className="text-xs text-soft">{auction.endsIn} left</span>
        </div>
      </div>
    </div>
  )
  if (auction.href && !sample) {
    return (
      <Link href={auction.href} className="block hover:bg-mist/40 -mx-2 px-2 rounded-lg transition">
        {inner}
      </Link>
    )
  }
  return inner
}

function liveToSample(a: AuctionSummary): SampleAuction {
  return {
    id: `${a.chainId}-${a.listingId}`,
    title: a.title || `Lot #${a.listingId}`,
    lotLabel: 'Live auction',
    currentBid: `${a.hasBid ? a.currentBid : a.reserve} ETH`,
    endsIn:
      a.endsAt > 0
        ? `${Math.max(0, Math.floor((a.endsAt * 1000 - Date.now()) / 3600000))}h`
        : 'Open',
    imageUrl: a.imageUrl,
    href: `/auctions/${a.chainId}/${a.listingId}`,
  }
}

export function HomeListingsSection({ preview }: { preview: boolean }) {
  const { chainId } = useAppChain()
  const { data: live } = useQuery({
    queryKey: ['homeAuctions', chainId],
    queryFn: async () => {
      const res = await fetch(`/api/auctions?chainId=${chainId}&limit=4`)
      if (!res.ok) return []
      const json = await res.json()
      return (json.auctions as AuctionSummary[]).map(liveToSample)
    },
    enabled: !preview,
    staleTime: 60_000,
  })

  const auctions = preview ? SAMPLE_AUCTIONS : live ?? []

  return (
    <section className="sm-band-sky border-b-2 border-line">
      <div className="sm-container py-10 md:py-14">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-10">
        <div className="lg:col-span-3">
          <div className="flex items-end justify-between gap-4 mb-5">
            <div>
              <h2 className="sm-heading text-2xl md:text-3xl">Featured auctions</h2>
              <p className="mt-1 text-sm text-mute">Timed lots from the auction house.</p>
            </div>
            <Link href="/auctions" className="text-sm text-sky-deep hover:underline shrink-0 sm-play">
              View all auctions
            </Link>
          </div>

          {preview && auctions.length > 0 && (
            <p className="mb-3 sm-play text-sm text-sky-deep">
              Sample data · preview mode — not live lots
            </p>
          )}

          <div className="sm-card p-5 md:p-6">
            {auctions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="sm-heading text-xl text-ink">Auctions coming soon</p>
                <p className="mt-2 text-sm text-mute max-w-sm mx-auto leading-relaxed">
                  English auctions will list here beside pools. Browse the stub page for updates.
                </p>
                <Link href="/auctions" className="sm-btn-secondary inline-flex mt-6">
                  View all auctions
                </Link>
                {!preview && (
                  <p className="mt-4">
                    <Link href="/?preview=1" className="text-xs text-soft hover:text-mute sm-play">
                      Preview with sample lots
                    </Link>
                  </p>
                )}
              </div>
            ) : (
              <div>
                {auctions.map((a) => (
                  <AuctionCard key={a.id} auction={a} sample={preview} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <h2 className="sm-heading text-2xl md:text-3xl mb-5">Create a listing</h2>
          <div className="sm-card p-5 md:p-6 shadow-play h-full">
            <p className="text-sm text-mute leading-relaxed mb-5">
              List NFTs you already own. No minting or metadata edits here — those live in studio.
            </p>
            <ul className="space-y-3">
              <ListingOption
                href="/create"
                title="Pool"
                body="Bonding-curve liquidity. Always open to buy and sell."
                cta="Create pool"
              />
              <ListingOption
                href="/create/auction"
                title="Auction"
                body="Timed English auction for a piece you hold."
                cta="Coming soon"
                soon
              />
              <ListingOption
                href="/create/fixed-price"
                title="Fixed price"
                body="Set a single ask for one or more tokens."
                cta="Coming soon"
                soon
              />
            </ul>
          </div>
        </div>
      </div>
      </div>
    </section>
  )
}

function ListingOption({
  href,
  title,
  body,
  cta,
  soon,
}: {
  href: string
  title: string
  body: string
  cta: string
  soon?: boolean
}) {
  return (
    <li>
      <Link
        href={href}
        className="block rounded-xl border-2 border-line px-4 py-3.5 hover:border-sky hover:bg-sky/5 transition"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="sm-heading text-base text-ink">{title}</p>
            <p className="mt-0.5 text-xs text-mute leading-relaxed">{body}</p>
          </div>
          <span
            className={`text-xs shrink-0 mt-0.5 ${
              soon ? 'sm-play text-soft uppercase tracking-wider' : 'text-orange-deep font-medium'
            }`}
          >
            {cta}
          </span>
        </div>
      </Link>
    </li>
  )
}
