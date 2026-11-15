'use client'

import Link from 'next/link'
import { formatEth, formatFeeBps } from '@/lib/quotes'
import { curvePlainName, poolTypeLabel, CurveType } from '@/lib/chains'
import { placeholderArtFromAddress, shortCollectionLabel } from '@/lib/sampleArt'

export interface PoolListItem {
  poolAddress: string
  nft: string
  poolType: number
  spotPrice: string
  delta: string
  fee: string
  curveType: string
  owner?: string | null
  collectionName?: string
  imageUrl?: string
  isSample?: boolean
}

function shortAddr(addr: string) {
  if (!addr || addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function PoolListCard({
  pool,
  chainId,
}: {
  pool: PoolListItem
  chainId: number
}) {
  const spot = formatEth(BigInt(pool.spotPrice))
  const fee = formatFeeBps(BigInt(pool.fee))
  const name = shortCollectionLabel(pool.nft, pool.collectionName)
  const art = pool.imageUrl || placeholderArtFromAddress(pool.nft || pool.poolAddress)

  const inner = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden bg-mist">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art} alt="" className="h-full w-full object-cover" />
        {pool.isSample && (
          <span className="sm-badge-sample absolute left-3 top-3 z-10 shadow-play">Sample</span>
        )}
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
          <span className="sm-chip bg-white/95 border-white">{poolTypeLabel(pool.poolType)}</span>
          <span className="sm-chip bg-white/95 border-white">
            {curvePlainName(pool.curveType as CurveType)}
          </span>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="sm-heading text-lg leading-snug truncate">{name}</p>
            <p className="mt-1 font-mono text-[11px] text-soft truncate" title={pool.poolAddress}>
              {shortAddr(pool.poolAddress)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-sans text-xl font-semibold text-ink tabular-nums">{spot}</p>
            <p className="text-[11px] uppercase tracking-wider text-soft">ETH spot</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-mute">Fee {fee}</p>
      </div>
    </>
  )

  if (pool.isSample) {
    return (
      <div className="sm-card sm-card-tilt overflow-hidden transition shadow-play">{inner}</div>
    )
  }

  return (
    <Link
      href={`/pool/${chainId}/${pool.poolAddress}`}
      className="sm-card sm-card-tilt block overflow-hidden hover:border-sky transition group"
    >
      {inner}
      <p className="px-4 pb-3 text-xs text-sky-deep opacity-0 group-hover:opacity-100 transition sm-play">
        View pool →
      </p>
    </Link>
  )
}
