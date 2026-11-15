'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Address, isAddress, getAddress } from 'viem'
import { usePoolData } from '@/hooks/usePoolData'
import { CurveExplainer } from '@/components/CurveExplainer'
import { TradePanel } from '@/components/TradePanel'
import { getPublicClient } from '@/lib/wagmi'
import { LSSVM_PAIR_ABI } from '@/lib/contracts'
import { getChainName, getCurveType, isSupportedChainId, poolTypeLabel } from '@/lib/chains'
import { formatEth, formatFeeBps } from '@/lib/quotes'
import { PAIR_MANAGE_ABI } from '@/lib/pairManage'

export default function PoolDetailPage() {
  const params = useParams()
  const chainIdRaw = Array.isArray(params.chainId) ? params.chainId[0] : params.chainId
  const poolRaw = Array.isArray(params.poolAddress) ? params.poolAddress[0] : params.poolAddress
  const chainId = parseInt(chainIdRaw || '8453', 10)
  const valid =
    isSupportedChainId(chainId) && typeof poolRaw === 'string' && isAddress(poolRaw)
  const poolAddress = valid ? (getAddress(poolRaw) as Address) : undefined
  const { data: pool, isLoading, error } = usePoolData(poolAddress, chainId)
  const [isERC1155, setIsERC1155] = useState(false)
  const [poolNftId, setPoolNftId] = useState<bigint | null>(null)
  const [owner, setOwner] = useState<Address | null>(null)

  useEffect(() => {
    if (!pool || !poolAddress) return
    const client = getPublicClient(chainId)
    ;(async () => {
      try {
        const variant = (await client.readContract({
          address: poolAddress,
          abi: LSSVM_PAIR_ABI,
          functionName: 'pairVariant',
        })) as number
        const erc1155 = variant === 2 || variant === 3
        setIsERC1155(erc1155)
        if (erc1155) {
          const id = (await client.readContract({
            address: poolAddress,
            abi: LSSVM_PAIR_ABI,
            functionName: 'nftId',
          })) as bigint
          setPoolNftId(id)
        }
      } catch {
        setIsERC1155(false)
      }
      try {
        const o = (await client.readContract({
          address: poolAddress,
          abi: PAIR_MANAGE_ABI,
          functionName: 'owner',
        })) as Address
        setOwner(o)
      } catch {
        setOwner(null)
      }
    })()
  }, [pool, poolAddress, chainId])

  if (!valid || !poolAddress) {
    return (
      <div className="sm-container py-16 text-center text-mute text-sm">Invalid pool link.</div>
    )
  }

  if (isLoading) {
    return <div className="sm-container py-16 text-center text-mute text-sm">Loading pool…</div>
  }

  if (error || !pool) {
    return (
      <div className="sm-container py-16 max-w-lg mx-auto text-center">
        <p className="text-clay font-medium">Could not load pool</p>
        <p className="mt-2 text-sm text-mute">{(error as Error)?.message || 'Unknown error'}</p>
        <Link href="/explore" className="sm-btn-secondary inline-flex mt-6">
          Back to explore
        </Link>
      </div>
    )
  }

  const curveType = getCurveType(chainId, pool.bondingCurve)

  return (
    <div className="sm-band-sky min-h-full">
    <div className="sm-container py-8 md:py-12">
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-soft">
        <Link href="/explore" className="hover:text-ink">
          Explore
        </Link>
        <span>/</span>
        <span>{getChainName(chainId)}</span>
        <span>/</span>
        <span className="font-mono">{poolAddress.slice(0, 10)}…</span>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-6">
          {/* Visual anchor */}
          <div className="sm-card overflow-hidden shadow-play">
            <div
              className="aspect-[16/10] bg-mist flex items-end p-6"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, #ffedd5 0%, #fdba74 45%, #c2410c 100%)',
              }}
            >
              <div>
                <p className="sm-heading text-3xl text-white drop-shadow">
                  {poolTypeLabel(pool.poolType)} pool
                </p>
                <p className="mt-1 text-sm text-white/90">
                  {isERC1155 ? 'ERC-1155' : 'ERC-721'} · {curveType}
                </p>
              </div>
            </div>
            <div className="p-5 grid sm:grid-cols-3 gap-4 border-t border-line">
              <Stat label="Spot price" value={`${formatEth(pool.spotPrice)} ETH`} />
              <Stat label="Delta" value={`${formatEth(pool.delta)} ETH`} />
              <Stat label="Pool fee" value={formatFeeBps(pool.fee)} />
            </div>
          </div>

          <CurveExplainer
            poolType={pool.poolType}
            curveType={curveType}
            spotPrice={pool.spotPrice}
            delta={pool.delta}
            fee={pool.fee}
          />

          <div className="sm-card p-5 space-y-2 text-sm">
            <p>
              <span className="text-soft">NFT contract</span>
              <br />
              <span className="font-mono text-xs break-all">{pool.nft}</span>
            </p>
            {owner && (
              <p>
                <span className="text-soft">Owner</span>
                <br />
                <span className="font-mono text-xs break-all">{owner}</span>
              </p>
            )}
            <div className="pt-2 flex flex-wrap gap-3">
              <Link
                href={`/embed/pool/${chainId}/${poolAddress}`}
                className="text-forest text-xs hover:underline"
                target="_blank"
              >
                Embed card
              </Link>
              <Link href={`/my-pools`} className="text-forest text-xs hover:underline">
                Manage my pools
              </Link>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <TradePanel
            chainId={chainId}
            poolAddress={poolAddress}
            isERC1155={isERC1155}
            poolNftId={poolNftId}
          />
        </div>
      </div>
    </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-soft">{label}</p>
      <p className="mt-1 font-mono text-sm text-ink">{value}</p>
    </div>
  )
}
