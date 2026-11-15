'use client'

import { explainLinearCurve, explainPoolForArtist, formatEth, formatFeeBps } from '@/lib/quotes'
import { curvePlainName, poolTypePlain, CurveType } from '@/lib/chains'

interface CurveExplainerProps {
  poolType: number
  curveType: CurveType | 'UNKNOWN'
  spotPrice: bigint
  delta: bigint
  fee: bigint
  compact?: boolean
}

export function CurveExplainer({
  poolType,
  curveType,
  spotPrice,
  delta,
  fee,
  compact,
}: CurveExplainerProps) {
  const spot = formatEth(spotPrice)
  const d = formatEth(delta)
  const body =
    curveType === 'LINEAR'
      ? explainLinearCurve(spot, d)
      : `This pool uses a ${curvePlainName(curveType)} curve. Spot price is about ${spot} ETH; each trade moves the price according to the curve.`

  if (compact) {
    return (
      <p className="text-sm text-mute leading-relaxed">
        {poolTypePlain(poolType)}. Fee {formatFeeBps(fee)}. {body}
      </p>
    )
  }

  return (
    <aside className="sm-card p-5 space-y-3">
      <h3 className="sm-heading text-lg">How pricing works</h3>
      <p className="text-sm text-mute leading-relaxed">{explainPoolForArtist(poolType)}</p>
      <p className="text-sm text-ink/80 leading-relaxed">{body}</p>
      <dl className="grid grid-cols-3 gap-3 pt-2 border-t border-line text-center">
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-soft">Spot</dt>
          <dd className="mt-1 font-mono text-sm">{spot} ETH</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-soft">Step (Δ)</dt>
          <dd className="mt-1 font-mono text-sm">{d} ETH</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wider text-soft">Pool fee</dt>
          <dd className="mt-1 font-mono text-sm">{formatFeeBps(fee)}</dd>
        </div>
      </dl>
    </aside>
  )
}
