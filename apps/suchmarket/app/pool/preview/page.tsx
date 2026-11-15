'use client'

import Link from 'next/link'
import { formatEth, formatFeeBps } from '@/lib/quotes'
import { curvePlainName, poolTypeLabel } from '@/lib/chains'
import { PREVIEW_POOL_DETAIL } from '@/lib/homeFixtures'

/**
 * Static preview of pool detail chrome for screenshots when no live pools exist.
 * Not a real trade path — sample data only.
 */
export default function PoolPreviewPage() {
  const p = PREVIEW_POOL_DETAIL
  const spot = formatEth(BigInt(p.spotPrice))
  const fee = formatFeeBps(BigInt(p.fee))
  const delta = formatEth(BigInt(p.delta))

  return (
    <div className="sm-band-sky min-h-full">
    <div className="sm-container py-8 md:py-12">
      <p className="sm-play text-sm text-sky-deep mb-4">
        Sample pool · preview mode — not on-chain
      </p>
      <div className="grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div className="sm-card overflow-hidden shadow-play">
            <div className="relative aspect-[16/10] bg-mist">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
              <span className="sm-badge-sample absolute left-4 top-4">Sample</span>
            </div>
            <div className="p-5 md:p-6">
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="sm-chip">{poolTypeLabel(p.poolType)}</span>
                <span className="sm-chip">{curvePlainName(p.curveType)}</span>
              </div>
              <h1 className="sm-heading text-3xl md:text-4xl">{p.collectionName}</h1>
              <p className="mt-2 font-mono text-xs text-soft">{p.poolAddress}</p>
              <div className="mt-6 flex flex-wrap gap-6">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-soft">Spot</p>
                  <p className="font-sans text-2xl font-semibold tabular-nums">{spot} ETH</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-soft">Delta</p>
                  <p className="font-sans text-2xl font-semibold tabular-nums">{delta}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-soft">Fee</p>
                  <p className="font-sans text-2xl font-semibold tabular-nums">{fee}</p>
                </div>
              </div>
            </div>
          </div>
          <aside className="sm-card p-5 space-y-3">
            <h3 className="sm-heading text-lg">How pricing works</h3>
            <p className="text-sm text-mute leading-relaxed">
              Trade pool — collectors can buy from or sell into the curve. Spot moves a little with
              each trade so liquidity stays two-way.
            </p>
          </aside>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="sm-card p-5 space-y-4 shadow-play">
            <p className="sm-heading text-xl">Trade</p>
            <div className="flex rounded-xl border-2 border-line p-0.5 bg-mist/50">
              <span className="flex-1 rounded-xl py-2 text-sm text-center bg-white text-orange-deep font-medium shadow-sm">
                Buy
              </span>
              <span className="flex-1 rounded-xl py-2 text-sm text-center text-mute">Sell</span>
            </div>
            <div>
              <label className="sm-label">Quantity</label>
              <input className="sm-input" defaultValue={1} readOnly />
            </div>
            <div>
              <label className="sm-label">Buy mode (ERC-721)</label>
              <div className="flex rounded-xl border-2 border-line p-0.5 bg-mist/50 mb-3">
                <button
                  type="button"
                  className="flex-1 rounded-lg py-1.5 text-xs bg-white shadow-sm font-medium"
                >
                  Any 1 NFT
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg py-1.5 text-xs text-mute"
                >
                  Specific IDs
                </button>
              </div>
            </div>
            <div className="rounded-xl bg-mist/80 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-mute">You pay</span>
                <span className="font-mono tabular-nums">~{spot} ETH</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-soft">Sample quote</span>
                <span className="sm-play text-sky-deep">Preview only</span>
              </div>
            </div>
            <button type="button" className="sm-btn-primary w-full" disabled>
              Connect wallet to trade
            </button>
          </div>
          <Link href="/?preview=1" className="sm-btn-secondary w-full">
            Back to home preview
          </Link>
        </div>
      </div>
    </div>
    </div>
  )
}
