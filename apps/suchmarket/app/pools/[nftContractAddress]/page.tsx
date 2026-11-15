'use client'

import { useParams } from 'next/navigation'
import { useChainId } from 'wagmi'
import { isAddress, Address } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import Link from 'next/link'
import { formatPrice } from '@/lib/pool'
import { queryPoolsByNFTContract } from '@/lib/subgraph'
import { useQuery } from '@tanstack/react-query'

function getChainIdFromParams(chainIdParam: string | string[] | undefined, currentChainId: number): number {
  if (chainIdParam) {
    const id = Array.isArray(chainIdParam) ? parseInt(chainIdParam[0]) : parseInt(chainIdParam)
    if (!isNaN(id) && (id === base.id || id === baseSepolia.id)) {
      return id
    }
  }
  return currentChainId || base.id
}

function getPoolTypeLabel(poolType: number): string {
  return poolType === 0 ? 'TOKEN' : poolType === 1 ? 'NFT' : 'TRADE'
}

function getPoolVariantLabel(poolVariant: number): string {
  const labels = ['ERC721/ETH', 'ERC721/ERC20', 'ERC1155/ETH', 'ERC1155/ERC20']
  return labels[poolVariant] || 'Unknown'
}

export default function PoolsPage() {
  const params = useParams()
  const nftContractAddress = params.nftContractAddress as string
  const currentChainId = useChainId()
  const chainId = getChainIdFromParams(params.chainId as string | string[] | undefined, currentChainId)

  const { data: pools, isLoading, error } = useQuery({
    queryKey: ['pools', nftContractAddress, chainId],
    queryFn: async () => {
      if (!isAddress(nftContractAddress)) return []
      return await queryPoolsByNFTContract(chainId, nftContractAddress as Address)
    },
    enabled: isAddress(nftContractAddress),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  if (!isAddress(nftContractAddress)) {
    return (
      <main className="min-h-screen p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-red-600">Invalid contract address</div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-bold mb-2">Pools</h1>
          <div className="text-sm text-gray-600 font-mono break-all mb-2">
            NFT Contract: {nftContractAddress}
          </div>
          <div className="text-xs text-gray-500">
            Chain: {chainId === base.id ? 'Base Mainnet' : chainId === baseSepolia.id ? 'Base Sepolia' : `Chain ${chainId}`}
          </div>
        </div>

        {isLoading ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading pools...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <p className="text-red-600 font-semibold mb-2">Error loading pools</p>
            <p className="text-sm text-red-500">
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </p>
          </div>
        ) : !pools || pools.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-500 mb-2">No pools found for this NFT contract.</p>
            <p className="text-sm text-gray-400 mb-4">
              Create a new pool to get started.
            </p>
            <Link
              href={`/create/${chainId}`}
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create a Pool
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-gray-600">
              Found {pools.length} pool{pools.length !== 1 ? 's' : ''}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pools.map((pool) => {
                const spotPrice = BigInt(pool.spotPrice)
                const delta = BigInt(pool.delta)
                const fee = BigInt(pool.fee)
                const currentTokenBalance = pool.currentTokenBalance ? BigInt(pool.currentTokenBalance) : 0n
                const currentNFTBalance = pool.currentNFTBalance ? BigInt(pool.currentNFTBalance) : 0n

                return (
                  <Link
                    key={pool.id}
                    href={`/pool/${chainId}/${pool.id}`}
                    className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="font-mono text-sm text-gray-600 truncate flex-1">
                        {pool.id.slice(0, 10)}...{pool.id.slice(-8)}
                      </div>
                      <div className="flex gap-1 ml-2">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-semibold whitespace-nowrap">
                          {getPoolTypeLabel(pool.poolType)}
                        </span>
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded font-semibold whitespace-nowrap">
                          {getPoolVariantLabel(pool.poolVariant)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Spot Price */}
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Spot Price</div>
                        <div className="text-lg font-semibold text-gray-900">
                          {formatPrice(spotPrice)} {pool.poolVariant === 1 || pool.poolVariant === 3 ? 'Tokens' : 'ETH'}
                        </div>
                      </div>

                      {/* Delta */}
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Delta</div>
                        <div className="text-sm font-medium text-gray-700">
                          {formatPrice(delta)} {pool.poolVariant === 1 || pool.poolVariant === 3 ? 'Tokens' : 'ETH'}
                        </div>
                      </div>

                      {/* Fee */}
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Fee</div>
                        <div className="text-sm font-medium text-gray-700">
                          {(Number(fee) / 100).toFixed(2)}%
                        </div>
                      </div>

                      {/* Current Balances */}
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Token Balance</div>
                          <div className="text-sm font-medium text-gray-700">
                            {formatPrice(currentTokenBalance)} {pool.poolVariant === 1 || pool.poolVariant === 3 ? 'Tokens' : 'ETH'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">NFT Balance</div>
                          <div className="text-sm font-medium text-gray-700">
                            {currentNFTBalance.toString()}
                          </div>
                        </div>
                      </div>

                      {/* ERC1155 NFT ID */}
                      {pool.nftId && (
                        <div>
                          <div className="text-xs text-gray-500 mb-1">NFT ID</div>
                          <div className="text-sm font-medium text-gray-700 font-mono">
                            #{pool.nftId}
                          </div>
                        </div>
                      )}

                      {/* Created At */}
                      <div className="pt-3 border-t border-gray-200">
                        <div className="text-xs text-gray-400">
                          Created: {new Date(Number(pool.createdAt) * 1000).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </div>
    </main>
  )
}

