'use client'

import { useState } from 'react'
import { NFTMetadata } from '@/lib/metadata'

interface UserNFTCardProps {
  tokenId: bigint
  metadata: NFTMetadata | null
  isLoading?: boolean
  isSelected?: boolean
  onSelect?: (tokenId: bigint) => void
  onDeselect?: (tokenId: bigint) => void
}

export function UserNFTCard({ 
  tokenId, 
  metadata, 
  isLoading, 
  isSelected = false,
  onSelect,
  onDeselect 
}: UserNFTCardProps) {
  const imageUrl = metadata?.image || '/placeholder-nft.png'
  const hasImageUrl = imageUrl && imageUrl !== '/placeholder-nft.png'
  const [imageLoading, setImageLoading] = useState(hasImageUrl)
  const [imageError, setImageError] = useState(false)

  const handleClick = () => {
    if (isSelected) {
      onDeselect?.(tokenId)
    } else {
      onSelect?.(tokenId)
    }
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
  const hasImage = hasImageUrl && !imageError

  return (
    <div 
      className={`bg-white border-2 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${
        isSelected 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={handleClick}
    >
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
        {isSelected && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold text-gray-900 truncate text-sm">{name}</h3>
        <p className="text-xs text-gray-500 font-mono">#{tokenId.toString()}</p>
      </div>
    </div>
  )
}

