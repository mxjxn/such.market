'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { isAddress } from 'viem'
import { isSupportedChainId, getChainName } from '@/lib/chains'
import { formatEth } from '@/lib/quotes'
import { PoolListItem } from '@/components/PoolListCard'

export default function EmbedCollectionCard() {
  const params = useParams()
  const chainId = parseInt(
    Array.isArray(params.chainId) ? params.chainId[0] : params.chainId || '8453',
    10
  )
  const nft = Array.isArray(params.nftContract) ? params.nftContract[0] : params.nftContract

  const { data, isLoading } = useQuery({
    queryKey: ['embedCollection', chainId, nft],
    queryFn: async () => {
      const res = await fetch(
        `/api/pools?chainId=${chainId}&nft=${nft}&lookback=400000`
      )
      if (!res.ok) throw new Error('failed')
      return res.json() as Promise<{ pools: PoolListItem[] }>
    },
    enabled: isSupportedChainId(chainId) && !!nft && isAddress(nft),
  })

  if (!isSupportedChainId(chainId) || !nft || !isAddress(nft)) {
    return <div className="p-4 text-xs text-mute">Invalid embed</div>
  }

  const pools = data?.pools || []
  const lowest = pools[0]
  const href = `/explore?nft=${nft}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block w-full max-w-sm rounded-2xl border-2 border-line bg-white p-4 shadow-play"
    >
      <p className="text-[10px] uppercase tracking-wider text-soft">such.market · collection</p>
      <p className="mt-1 font-mono text-xs text-ink truncate">{nft}</p>
      <p className="mt-2 text-sm text-mute">
        {isLoading
          ? 'Loading…'
          : pools.length
            ? `${pools.length} pool${pools.length === 1 ? '' : 's'} on ${getChainName(chainId)}`
            : `No pools yet · ${getChainName(chainId)}`}
      </p>
      {lowest && (
        <p className="mt-2 sm-heading text-xl text-ink">
          from {formatEth(BigInt(lowest.spotPrice))} ETH
        </p>
      )}
      <p className="mt-3 text-xs text-sky-deep">Browse liquidity →</p>
    </a>
  )
}
