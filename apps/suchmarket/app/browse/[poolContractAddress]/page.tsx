'use client'

import { useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

/** Legacy miniapp path → explore with NFT filter */
export default function BrowseRedirect() {
  const params = useParams()
  const router = useRouter()
  const search = useSearchParams()
  const nft = params.poolContractAddress as string
  const chainId = search.get('chainId') || '8453'

  useEffect(() => {
    router.replace(`/explore?nft=${nft}&chainId=${chainId}`)
  }, [nft, chainId, router])

  return (
    <div className="sm-container py-16 text-center text-sm text-mute">Redirecting to explore…</div>
  )
}
