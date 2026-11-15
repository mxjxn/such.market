'use client'

import { Address } from 'viem'
import { PoolType, CurveError } from '@/lib/contracts'
import { formatPrice } from '@/lib/pool'
import Link from 'next/link'
import { usePoolNFTs } from '@/hooks/usePoolNFTs'
import { useERC1155PoolMetadata } from '@/hooks/useERC1155PoolMetadata'
import NFTCard, { ERC1155Card } from './NFTCard'
import { Cart } from './Cart'

interface PoolDetailsProps {
  poolAddress: Address
  poolType: PoolType
  spotPrice: bigint
  delta: bigint
  fee: bigint
  nftAddress: Address
  tokenAddress: Address
  bondingCurve: Address
  chainId: number
  isERC1155?: boolean
  poolNftId?: bigint
  showCart?: boolean
}

export function PoolDetails({
  poolAddress,
  poolType,
  spotPrice,
  delta,
  fee,
  nftAddress,
  tokenAddress,
  bondingCurve,
  chainId,
  isERC1155 = false,
  poolNftId,
  showCart = true,
}: PoolDetailsProps) {
  const poolTypeLabel = PoolType[poolType] || 'UNKNOWN'

  // Fetch NFTs based on type
  const { data: poolNFTs, isLoading: isLoadingNFTs } = usePoolNFTs(
    isERC1155 ? undefined : poolAddress,
    isERC1155 ? undefined : nftAddress,
    chainId
  )

  const { data: erc1155Data, isLoading: isLoadingERC1155 } = useERC1155PoolMetadata(
    isERC1155 ? poolAddress : undefined,
    isERC1155 ? nftAddress : undefined,
    isERC1155 ? poolNftId : undefined,
    chainId
  )

  return (
    <div className="space-y-3">
      {showCart && (
        <Cart 
          poolAddress={poolAddress}
          chainId={chainId}
          isERC1155={isERC1155}
          poolNftId={poolNftId}
        />
      )}
      <div>
        <h1 className="text-xl font-bold mb-1">Pool Details</h1>
        <div className="text-xs text-gray-500 mb-2">Address: {poolAddress.slice(0, 10)}...{poolAddress.slice(-8)}</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <div className="border rounded p-2">
          <h3 className="font-semibold text-xs mb-1 text-gray-600">Pool Type</h3>
          <div className="text-sm">{poolTypeLabel}</div>
        </div>

        <div className="border rounded p-2">
          <h3 className="font-semibold text-xs mb-1 text-gray-600">Spot Price</h3>
          <div className="text-sm">{formatPrice(spotPrice)} ETH</div>
        </div>

        <div className="border rounded p-2">
          <h3 className="font-semibold text-xs mb-1 text-gray-600">Delta</h3>
          <div className="text-sm">{delta.toString()}</div>
        </div>

        <div className="border rounded p-2">
          <h3 className="font-semibold text-xs mb-1 text-gray-600">Fee</h3>
          <div className="text-sm">{fee.toString()}</div>
        </div>

        <div className="border rounded p-2">
          <h3 className="font-semibold text-xs mb-1 text-gray-600">NFT Collection</h3>
          <div className="text-xs font-mono truncate" title={nftAddress}>{nftAddress.slice(0, 6)}...{nftAddress.slice(-4)}</div>
        </div>

        <div className="border rounded p-2">
          <h3 className="font-semibold text-xs mb-1 text-gray-600">Paired Token</h3>
          <div className="text-xs font-mono truncate" title={tokenAddress}>
            {tokenAddress === '0x0000000000000000000000000000000000000000' 
              ? 'ETH' 
              : `${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)}`}
          </div>
        </div>

        <div className="border rounded p-2">
          <h3 className="font-semibold text-xs mb-1 text-gray-600">Bonding Curve</h3>
          <div className="text-xs font-mono truncate" title={bondingCurve}>{bondingCurve.slice(0, 6)}...{bondingCurve.slice(-4)}</div>
        </div>
      </div>

      {/* NFT Display Section */}
      <div className="mt-4">
        <h2 className="text-lg font-bold mb-2">NFTs in Pool</h2>
        {isERC1155 ? (
          <div>
            {isLoadingERC1155 ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600 mb-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"></div>
                  <span className="text-xs">Loading NFT...</span>
                </div>
                <ERC1155Card
                  nftId={poolNftId || 0n}
                  metadata={null}
                  balance={0n}
                  isLoading={true}
                />
              </div>
            ) : erc1155Data && poolNftId !== undefined ? (
              <ERC1155Card
                nftId={poolNftId}
                metadata={erc1155Data.metadata}
                balance={erc1155Data.balance}
                isLoading={false}
                poolAddress={poolAddress}
                chainId={chainId}
                spotPrice={spotPrice}
              />
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500">
                No NFT data available
              </div>
            )}
          </div>
        ) : (
          <div>
            {isLoadingNFTs ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600 mb-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"></div>
                  <span className="text-xs">Loading NFTs...</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-xl border-2 border-line bg-mist animate-pulse"
                    />
                  ))}
                </div>
              </div>
            ) : poolNFTs && poolNFTs.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {poolNFTs.map((nft) => (
                  <NFTCard
                    key={nft.tokenId.toString()}
                    tokenId={nft.tokenId}
                    metadata={nft.metadata}
                    isLoading={false}
                    nftContract={nftAddress}
                    poolAddress={poolAddress}
                    poolType={poolType}
                    poolVariant={0}
                    price={spotPrice}
                    chainId={chainId}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500">
                No NFTs found in this pool
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Link
          href={`/pool/${chainId}/${poolAddress}`}
          className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-semibold text-sm"
        >
          Trade
        </Link>
      </div>
    </div>
  )
}

