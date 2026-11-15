import Link from 'next/link'
import { Address } from 'viem'
import { PoolType } from '@/lib/contracts'
import { formatPrice } from '@/lib/pool'

interface PoolCardProps {
  poolAddress: Address
  poolType: PoolType
  spotPrice: bigint
  nftAddress: Address
  tokenAddress: Address
}

export function PoolCard({ poolAddress, poolType, spotPrice, nftAddress, tokenAddress }: PoolCardProps) {
  const poolTypeLabel = PoolType[poolType] || 'UNKNOWN'

  return (
    <Link href={`/pool/${poolAddress}`}>
      <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-lg truncate">{poolAddress.slice(0, 10)}...</h3>
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
            {poolTypeLabel}
          </span>
        </div>
        <div className="text-sm text-gray-600 space-y-1">
          <div>NFT: {nftAddress.slice(0, 8)}...</div>
          <div>Token: {tokenAddress.slice(0, 8)}...</div>
          <div className="font-medium text-gray-900">
            Spot Price: {formatPrice(spotPrice)} ETH
          </div>
        </div>
      </div>
    </Link>
  )
}

