'use client'

import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Suspense } from 'react'
import { useAppChain } from '@/contexts/ChainContext'
import { PoolListItem } from '@/components/PoolListCard'
import { HomePoolsSection } from '@/components/home/HomePoolsSection'
import { HomeListingsSection } from '@/components/home/HomeListingsSection'
import { isHomePreviewMode } from '@/lib/homeFixtures'

async function fetchPools(chainId: number) {
  const params = new URLSearchParams({ chainId: String(chainId), lookback: '80000' })
  const res = await fetch(`/api/pools?${params}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.details || err.error || 'Failed to load pools')
  }
  return res.json() as Promise<{ pools: PoolListItem[] }>
}

function HomeContent() {
  const { chainId } = useAppChain()
  const searchParams = useSearchParams()
  const preview = isHomePreviewMode(searchParams.get('preview'))

  const { data, isLoading, error } = useQuery({
    queryKey: ['homePools', chainId],
    queryFn: () => fetchPools(chainId),
  })

  return (
    <div>
      <HomePoolsSection
        chainId={chainId}
        pools={data?.pools ?? []}
        isLoading={isLoading}
        error={error as Error | null}
        preview={preview}
      />
      <HomeListingsSection preview={preview} />
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="sm-container py-16 text-sm text-mute">Loading market…</div>
      }
    >
      <HomeContent />
    </Suspense>
  )
}
