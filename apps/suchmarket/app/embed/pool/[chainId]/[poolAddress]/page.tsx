'use client'

import { useParams } from 'next/navigation'
import { Address, isAddress, getAddress } from 'viem'
import { usePoolData } from '@/hooks/usePoolData'
import { formatEth, formatFeeBps } from '@/lib/quotes'
import { getChainName, getCurveType, isSupportedChainId, poolTypeLabel } from '@/lib/chains'
import { placeholderArtFromAddress, shortCollectionLabel } from '@/lib/sampleArt'

/**
 * Lightweight embeddable pool card for cryptoart.social feeds.
 * Use in an iframe: /embed/pool/8453/0x…
 */
export default function EmbedPoolCard() {
  const params = useParams()
  const chainId = parseInt(
    Array.isArray(params.chainId) ? params.chainId[0] : params.chainId || '8453',
    10
  )
  const poolRaw = Array.isArray(params.poolAddress) ? params.poolAddress[0] : params.poolAddress
  const valid =
    isSupportedChainId(chainId) && typeof poolRaw === 'string' && isAddress(poolRaw)
  const poolAddress = valid ? (getAddress(poolRaw) as Address) : undefined
  const { data: pool, isLoading, error } = usePoolData(poolAddress, chainId)

  if (!valid || !poolAddress) {
    return <div className="p-4 text-xs text-mute">Invalid embed</div>
  }
  if (isLoading) {
    return <div className="p-4 text-xs text-mute animate-pulse">Loading…</div>
  }
  if (error || !pool) {
    return <div className="p-4 text-xs text-clay">Unavailable</div>
  }

  const curve = getCurveType(chainId, pool.bondingCurve)
  const href = `/pool/${chainId}/${poolAddress}`
  const art = placeholderArtFromAddress(pool.nft)
  const name = shortCollectionLabel(pool.nft)

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block w-full max-w-sm overflow-hidden rounded-2xl border-2 border-line bg-white shadow-play hover:border-sky transition"
      style={{ fontFamily: 'var(--font-sora), system-ui, sans-serif' }}
    >
      <div className="aspect-[16/10] overflow-hidden bg-mist">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="p-4">
        <p
          className="text-[10px] uppercase tracking-wider text-orange-deep"
          style={{ fontFamily: 'var(--font-comic), Comic Neue, cursive' }}
        >
          such.market
        </p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className="text-lg text-ink truncate"
              style={{ fontFamily: 'var(--font-comic), Comic Neue, cursive' }}
            >
              {name}
            </p>
            <p className="text-xs text-mute mt-0.5">
              {poolTypeLabel(pool.poolType)} · {getChainName(chainId)} · {curve}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-sans text-lg font-semibold tabular-nums text-ink">
              {formatEth(pool.spotPrice)}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-soft">ETH</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2 text-[11px] text-mute">
          <span className="sm-chip">Fee {formatFeeBps(pool.fee)}</span>
        </div>
        <p
          className="mt-3 text-xs text-sky-deep"
          style={{ fontFamily: 'var(--font-comic), Comic Neue, cursive' }}
        >
          Open on such.market →
        </p>
      </div>
    </a>
  )
}
