'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { NFTMetadata, fetchERC721Metadata, fetchERC1155Metadata } from '@/lib/metadata'
import { Address } from 'viem'
import { useCart } from '@/hooks/useCart'
import { QuantitySelector } from './QuantitySelector'
import { formatPrice } from '@/lib/pool'
import Link from 'next/link'

interface NFTCardProps {
  tokenId: bigint
  nftContract: Address
  poolAddress: Address
  poolType: number
  poolVariant: number
  price: bigint
  chainId: number
  amount?: bigint | null // For ERC1155
  metadata?: NFTMetadata | null
  isLoading?: boolean
  onAddToCart?: () => void
}

function getPoolTypeLabel(poolType: number): string {
  return poolType === 0 ? 'TOKEN' : poolType === 1 ? 'NFT' : 'TRADE'
}

function getPoolVariantLabel(poolVariant: number): string {
  const labels = ['ERC721/ETH', 'ERC721/ERC20', 'ERC1155/ETH', 'ERC1155/ERC20']
  return labels[poolVariant] || 'Unknown'
}

export default function NFTCard({ 
  tokenId, 
  nftContract,
  poolAddress, 
  poolType,
  poolVariant,
  price,
  chainId,
  amount,
  metadata: providedMetadata,
  isLoading: providedIsLoading,
  onAddToCart 
}: NFTCardProps) {
  const isERC1155 = poolVariant === 2 || poolVariant === 3

  // Fetch metadata if not provided
  const { data: fetchedMetadata, isLoading: metadataLoading } = useQuery({
    queryKey: ['nftMetadata', nftContract, tokenId.toString(), chainId, isERC1155],
    queryFn: async () => {
      if (isERC1155) {
        return await fetchERC1155Metadata(nftContract, tokenId, chainId)
      } else {
        return await fetchERC721Metadata(nftContract, tokenId, chainId)
      }
    },
    enabled: !providedMetadata,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const metadata = providedMetadata || fetchedMetadata || null
  const isLoading = providedIsLoading || metadataLoading
  const imageUrl = metadata?.image || '/placeholder-nft.png'
  const hasImageUrl = imageUrl && imageUrl !== '/placeholder-nft.png'
  const [imageLoading, setImageLoading] = useState(hasImageUrl)
  const [imageError, setImageError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const { addToCart } = useCart()

  const handleAddToCart = () => {
    if (!poolAddress || chainId === undefined) return
    
    addToCart({
      poolAddress,
      chainId,
      nftId: tokenId,
      quantity: 1,
      isERC1155: false,
      metadata,
    })
    
    onAddToCart?.()
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm animate-pulse">
        <div className="aspect-square bg-gray-200 rounded-lg mb-3"></div>
        <div className="h-4 bg-gray-200 rounded mb-2"></div>
        <div className="h-3 bg-gray-200 rounded w-2/3"></div>
      </div>
    )
  }

  const name = metadata?.name || `NFT #${tokenId.toString()}`
  const description = metadata?.description
  const hasImage = hasImageUrl && !imageError

  return (
    <Link href={`/pool/${chainId}/${poolAddress}`}>
      <div 
        className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Pool type badge */}
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-semibold">
            {getPoolTypeLabel(poolType)}
          </span>
          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded font-semibold">
            {getPoolVariantLabel(poolVariant)}
          </span>
        </div>

        <div className="aspect-square bg-gray-100 rounded-lg mb-3 overflow-hidden relative">
          {hasImage ? (
            <>
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600"></div>
                </div>
              )}
              <img
                src={imageUrl}
                alt={name}
                className={`w-full h-full object-cover ${imageLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
                onLoad={() => setImageLoading(false)}
                onError={(e) => {
                  setImageError(true)
                  setImageLoading(false)
                  const target = e.target as HTMLImageElement
                  target.src = '/placeholder-nft.png'
                }}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg
                className="w-12 h-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                preserveAspectRatio="xMidYMid meet"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>
        
        {/* Price and pool info */}
        <div className="mb-2">
          <div className="text-lg font-bold text-gray-900">
            {formatPrice(price)} {poolVariant === 1 || poolVariant === 3 ? 'Tokens' : 'ETH'}
          </div>
          {amount !== null && amount !== undefined && (
            <div className="text-xs text-gray-500 mt-1">
              Available: {amount.toString()}
            </div>
          )}
        </div>

        <div className="font-semibold text-gray-900 text-sm mb-1 truncate">{name}</div>
        {description && (
          <div className="text-xs text-gray-500 line-clamp-2 mb-1">{description}</div>
        )}
        <div className="text-xs text-gray-400 font-mono mb-2">#{tokenId.toString()}</div>
        
        {/* Pool address */}
        <div className="text-xs text-gray-400 font-mono truncate">
          Pool: {poolAddress.slice(0, 6)}...{poolAddress.slice(-4)}
        </div>

        {/* Add to cart overlay */}
        {isHovered && (
          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-xl flex items-center justify-center transition-opacity duration-200">
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                handleAddToCart()
              }}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold shadow-lg transition-colors"
            >
              Add to Cart
            </button>
          </div>
        )}
      </div>
    </Link>
  )
}

interface ERC1155CardProps {
  nftId: bigint
  metadata: NFTMetadata | null
  balance: bigint
  isLoading?: boolean
  poolAddress?: Address
  chainId?: number
  spotPrice?: bigint
  onAddToCart?: () => void
}

export function ERC1155Card({ nftId, metadata, balance, isLoading, poolAddress, chainId, spotPrice, onAddToCart }: ERC1155CardProps) {
  const imageUrl = metadata?.image || '/placeholder-nft.png'
  const hasImageUrl = imageUrl && imageUrl !== '/placeholder-nft.png'
  const [imageLoading, setImageLoading] = useState(hasImageUrl)
  const [imageError, setImageError] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const { addToCart } = useCart()

  const handleAddToCart = () => {
    if (!poolAddress || chainId === undefined) return
    
    addToCart({
      poolAddress,
      chainId,
      nftId,
      quantity,
      isERC1155: true,
      metadata,
    })
    
    onAddToCart?.()
    // Reset quantity after adding
    setQuantity(1)
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm animate-pulse">
        <div className="aspect-square bg-gray-200 rounded-lg mb-4 max-w-md mx-auto"></div>
        <div className="h-5 bg-gray-200 rounded mb-2 max-w-xs mx-auto"></div>
        <div className="h-4 bg-gray-200 rounded w-32 mx-auto"></div>
      </div>
    )
  }

  const name = metadata?.name || `NFT #${nftId.toString()}`
  const description = metadata?.description
  const hasImage = hasImageUrl && !imageError

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <div className="max-w-md mx-auto">
        <div className="aspect-square bg-gray-100 rounded-lg mb-4 overflow-hidden relative">
          {hasImage ? (
            <>
              {imageLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-600"></div>
                </div>
              )}
              <img
                src={imageUrl}
                alt={name}
                className={`w-full h-full object-cover ${imageLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
                onLoad={() => setImageLoading(false)}
                onError={(e) => {
                  setImageError(true)
                  setImageLoading(false)
                  const target = e.target as HTMLImageElement
                  target.src = '/placeholder-nft.png'
                }}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg
                className="w-16 h-16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                preserveAspectRatio="xMidYMid meet"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="font-semibold text-lg text-gray-900 mb-2">{name}</div>
          {description && (
            <div className="text-sm text-gray-600 mb-3 line-clamp-3">{description}</div>
          )}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg mb-4">
            <span className="text-sm font-semibold text-blue-900">Available:</span>
            <span className="text-lg font-bold text-blue-600">{balance.toString()}</span>
          </div>
          <div className="text-xs text-gray-400 font-mono mb-4">NFT ID: #{nftId.toString()}</div>
          
          {poolAddress && chainId !== undefined && balance > 0n && (
            <div className="mt-4 space-y-4">
              <QuantitySelector
                value={quantity}
                onChange={setQuantity}
                max={Number(balance)}
                showPrice={!!spotPrice}
                pricePerItem={spotPrice}
              />
              <button
                onClick={handleAddToCart}
                className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold transition-colors shadow-sm"
              >
                Add {quantity} to Cart
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

