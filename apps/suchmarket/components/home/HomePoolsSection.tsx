'use client'

import Link from 'next/link'
import { PoolListCard, PoolListItem } from '@/components/PoolListCard'
import { SAMPLE_POOLS } from '@/lib/homeFixtures'

export function HomePoolsSection({
  chainId,
  pools,
  isLoading,
  error,
  preview,
}: {
  chainId: number
  pools: PoolListItem[]
  isLoading: boolean
  error: Error | null
  preview: boolean
}) {
  const showSamples = preview && pools.length === 0 && !isLoading
  const items = showSamples ? SAMPLE_POOLS : pools

  return (
    <section className="sm-band-orange relative overflow-hidden border-b-2 border-line">
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          backgroundImage:
            'radial-gradient(circle at 12% 75%, rgba(234,88,12,0.28), transparent 42%), radial-gradient(ellipse 50% 40% at 90% 15%, rgba(253,186,116,0.45), transparent)',
        }}
      />
      <div className="sm-container relative py-10 md:py-14">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
          <div>
            <p className="sm-wordmark text-4xl md:text-6xl text-orange-deep">
              such.market
            </p>
            <h1 className="mt-3 text-base md:text-lg text-mute font-normal max-w-xl leading-relaxed">
              Recent pools — buy and sell on a bonding curve.
            </h1>
          </div>
          <Link href="/explore" className="sm-btn-secondary shrink-0 self-start md:self-auto">
            Explore all
          </Link>
        </div>

        {showSamples && (
          <p className="mb-4 sm-play text-sm text-sky-deep">
            Sample data · preview mode — not on-chain (just vibes)
          </p>
        )}

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy aria-label="Loading pools">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="sm-card overflow-hidden animate-pulse"
              >
                <div className="aspect-[4/3] bg-mist" />
                <div className="p-4 space-y-2">
                  <div className="h-5 w-2/3 rounded bg-mist" />
                  <div className="h-4 w-1/3 rounded bg-mist" />
                </div>
              </div>
            ))}
          </div>
        ) : error && !showSamples ? (
          <div className="sm-card p-8 text-center">
            <p className="sm-heading text-xl text-clay">Could not load pools</p>
            <p className="mt-2 text-xs text-mute">{error.message}</p>
            <Link href="/explore" className="sm-btn-secondary inline-flex mt-6">
              Try explore
            </Link>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-line bg-white/70 px-6 py-14 text-center shadow-play">
            <p className="sm-heading text-2xl text-ink">No pools yet</p>
            <p className="mt-2 text-sm text-mute max-w-md mx-auto leading-relaxed">
              When traders open buy, sell, or trade pools on this chain, they will appear here.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/create" className="sm-btn-primary">
                Create a pool
              </Link>
              <Link href="/?preview=1" className="sm-btn-ghost text-xs sm-play">
                Preview with samples
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.slice(0, 6).map((pool) => (
              <PoolListCard key={pool.poolAddress} pool={pool} chainId={chainId} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
