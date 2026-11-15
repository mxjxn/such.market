'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Address, isAddress } from 'viem'
import { CreatePoolForm, CreatePoolFormData } from '@/components/CreatePoolForm'
import { useCreatePool } from '@/hooks/useCreatePool'
import { useAppChain } from '@/contexts/ChainContext'
import { isSupportedChainId, SupportedChainId } from '@/lib/chains'

export default function CreateChainPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setChainId } = useAppChain()
  const chainId = parseInt(
    Array.isArray(params.chainId) ? params.chainId[0] : params.chainId || '8453',
    10
  )
  const [initialFormData, setInitialFormData] = useState<Partial<CreatePoolFormData> | null>(null)
  const { createPool, poolAddress, error, isPending, isSuccess } = useCreatePool(chainId)

  useEffect(() => {
    if (isSupportedChainId(chainId)) setChainId(chainId as SupportedChainId)
  }, [chainId, setChainId])

  useEffect(() => {
    const nftContract = searchParams.get('nftContract')
    if (nftContract && isAddress(nftContract)) {
      setInitialFormData({
        nftContract: nftContract as Address,
        nftType: (searchParams.get('nftType') as 'ERC721' | 'ERC1155') || 'ERC721',
        paymentToken: 'ETH',
        bondingCurve:
          (searchParams.get('bondingCurve') as CreatePoolFormData['bondingCurve']) || 'LINEAR',
        spotPrice: searchParams.get('spotPrice') || '0.002',
        delta: searchParams.get('delta') || '0.01',
        fee: searchParams.get('fee') || '100',
        initialNFTIds: searchParams.get('initialNFTIds') || '',
        nftId: searchParams.get('nftId') || '0',
        initialNFTBalance: '1',
        initialTokenBalance: '0',
      })
    }
  }, [searchParams])

  useEffect(() => {
    if (isSuccess && poolAddress) {
      const t = setTimeout(() => router.push(`/pool/${chainId}/${poolAddress}`), 1500)
      return () => clearTimeout(t)
    }
  }, [isSuccess, poolAddress, chainId, router])

  if (!isSupportedChainId(chainId)) {
    return (
      <div className="sm-container py-16 text-center text-sm text-mute">Unsupported chain.</div>
    )
  }

  return (
    <div className="sm-container py-10 max-w-2xl">
      <h1 className="sm-heading text-3xl mb-6">Create a pool</h1>
      <div className="sm-card p-6">
        <CreatePoolForm
          chainId={chainId}
          onSubmit={(data) => createPool(data)}
          isSubmitting={isPending}
          error={error}
          initialData={initialFormData}
        />
      </div>
    </div>
  )
}
