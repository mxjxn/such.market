'use client'

import { useEffect, useState, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { isAddress } from 'viem'
import { useAppChain } from '@/contexts/ChainContext'
import { PoolListCard, PoolListItem } from '@/components/PoolListCard'
import { getChainName, isSupportedChainId, SupportedChainId } from '@/lib/chains'
import { SAMPLE_POOLS, isHomePreviewMode } from '@/lib/homeFixtures'

async function fetchPools(chainId: number, nft?: string, lookback?: string) {
  const params = new URLSearchParams({ chainId: String(chainId) })
  if (nft) params.set('nft', nft)
  if (lookback) params.set('lookback', lookback)
  const res = await fetch(`/api/pools?${params}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.details || err.error || 'Failed to load pools')
  }
  return res.json() as Promise<{ pools: PoolListItem[] }>
}

function ExploreContent() {
  const { chainId, setChainId } = useAppChain()
  const searchParams = useSearchParams()
  const preview = isHomePreviewMode(searchParams.get('preview'))
  const [nftFilter, setNftFilter] = useState('')
  const [submittedNft, setSubmittedNft] = useState<string | undefined>()
  const lookback = submittedNft ? '500000' : '80000'

  useEffect(() => {
    const nft = searchParams.get('nft')
    const c = searchParams.get('chainId')
    if (nft && isAddress(nft)) {
      setNftFilter(nft)
      setSubmittedNft(nft)
    }
    if (c && isSupportedChainId(parseInt(c, 10))) {
      setChainId(parseInt(c, 10) as SupportedChainId)
    }
  }, [searchParams, setChainId])

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['explorePools', chainId, submittedNft, lookback],
    queryFn: () => fetchPools(chainId, submittedNft, lookback),
  })

  const onFilter = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nftFilter) {
      setSubmittedNft(undefined)
      return
    }
    if (!isAddress(nftFilter)) {
      alert('Enter a valid NFT contract address')
      return
    }
    setSubmittedNft(nftFilter)
  }

  const liveEmpty = !isLoading && !isFetching && !error && !data?.pools?.length
  const showSamples = preview && liveEmpty
  const pools = showSamples ? SAMPLE_POOLS : data?.pools ?? []

  return (
    <div className="sm-band-orange min-h-full">
    <div className="sm-container py-10">
      <header className="max-w-2xl mb-10">
        <h1 className="sm-heading text-3xl md:text-4xl">Explore</h1>
        <p className="mt-2 text-mute text-sm md:text-base leading-relaxed">
          Pools and collections on {getChainName(chainId)}. Filter by NFT contract to find liquidity
          for a specific collection. Prices update from the chain.
        </p>
      </header>

      <form onSubmit={onFilter} className="flex flex-col sm:flex-row gap-3 mb-8">
        <input
          className="sm-input flex-1 font-mono text-xs sm:text-sm"
          placeholder="Filter by NFT contract (0x…)"
          value={nftFilter}
          onChange={(e) => setNftFilter(e.target.value)}
        />
        <button type="submit" className="sm-btn-secondary">
          Apply
        </button>
        <button
          type="button"
          className="sm-btn-ghost"
          onClick={() => {
            setNftFilter('')
            setSubmittedNft(undefined)
            refetch()
          }}
        >
          Refresh
        </button>
      </form>

      {showSamples && (
        <p className="mb-4 sm-play text-sm text-sky-deep">
          Sample data · preview mode — not on-chain
        </p>
      )}

      {isLoading || isFetching ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="sm-card overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-mist" />
              <div className="p-4 h-20 bg-white" />
            </div>
          ))}
        </div>
      ) : error && !showSamples ? (
        <div className="sm-card p-6 text-center">
          <p className="sm-heading text-clay">Could not load pools</p>
          <p className="mt-2 text-xs text-mute">{(error as Error).message}</p>
          <p className="mt-4 text-xs text-soft">
            Tip: public RPCs rate-limit large log scans. Set NEXT_PUBLIC_BASE_RPC_URL to a dedicated
            endpoint, or filter by NFT contract.
          </p>
        </div>
      ) : !pools.length ? (
        <div className="sm-card p-8 text-center shadow-play">
          <p className="sm-heading text-xl">No pools found in this range.</p>
          <Link href="/create" className="sm-btn-primary inline-flex mt-4">
            Create the first pool
          </Link>
          <p className="mt-4">
            <Link href="/explore?preview=1" className="text-xs sm-play text-sky-deep">
              Preview with samples
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {pools.map((pool) => (
            <PoolListCard key={pool.poolAddress} pool={pool} chainId={chainId} />
          ))}
        </div>
      )}
    </div>
    </div>
  )
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="sm-container py-16 text-sm text-mute">Loading…</div>}>
      <ExploreContent />
    </Suspense>
  )
}
