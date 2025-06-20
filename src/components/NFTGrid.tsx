'use client';

import { useQuery } from '@tanstack/react-query';
import { useNFTTransition } from './NFTTransition';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface NFT {
  token_id: string;
  title?: string;
  description?: string;
  image_url?: string;
  thumbnail_url?: string;
  attributes?: Array<{
    trait_type: string;
    value: string;
  }>;
}

interface NFTGridProps {
  contractAddress: string;
}

export function NFTGrid({ contractAddress }: NFTGridProps) {
  const { navigateToNFT } = useNFTTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: response, isLoading, error, refetch } = useQuery({
    queryKey: ['nfts', contractAddress],
    queryFn: async () => {
      const response = await fetch(`/api/collection/${contractAddress}/nfts`);
      if (!response.ok) {
        throw new Error('Failed to fetch NFTs');
      }
      return response.json();
    },
  });

  const nfts = response?.nfts || [];

  // Check for NFTs missing metadata
  const nftsMissingMetadata = nfts.filter((nft: NFT) => {
    const hasTitle = nft.title && nft.title !== `NFT #${nft.token_id}` && nft.title !== `Token ${nft.token_id}`;
    const hasImage = nft.image_url && nft.image_url.trim() !== '';
    const hasMetadata = nft.attributes && nft.attributes.length > 0;
    
    return !hasTitle || !hasImage || !hasMetadata;
  });

  const hasMissingMetadata = nftsMissingMetadata.length > 0;

  const handleRefreshMetadata = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      // Trigger a refetch which will trigger the background metadata fetch
      await refetch();
      
      // Wait a bit for the background fetch to complete
      setTimeout(() => {
        refetch();
      }, 2000);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden animate-pulse">
            <div className="aspect-square bg-gray-200 dark:bg-gray-700"></div>
            <div className="p-4 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="flex gap-1">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Error loading NFTs: {error.message}</p>
      </div>
    );
  }

  if (!nfts || nfts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No NFTs found in this collection.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Metadata refresh indicator */}
      {hasMissingMetadata && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Metadata Incomplete
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {nftsMissingMetadata.length} NFT{nftsMissingMetadata.length !== 1 ? 's' : ''} missing metadata
                </p>
              </div>
            </div>
            <button
              onClick={handleRefreshMetadata}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-2 bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-md hover:bg-yellow-200 dark:hover:bg-yellow-700 transition-colors disabled:opacity-50"
            >
              {isRefreshing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {isRefreshing ? 'Fetching...' : 'Fetch Metadata'}
            </button>
          </div>
        </div>
      )}

      {/* NFT Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {nfts.map((nft: NFT) => {
          const uniqueKey = `${contractAddress}-${nft.token_id}`;
          const isMissingMetadata = nftsMissingMetadata.some((missing: NFT) => missing.token_id === nft.token_id);
          
          return (
            <div
              key={uniqueKey}
              onClick={() => navigateToNFT(contractAddress, nft.token_id)}
              className={`block bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden card-hover nft-card cursor-pointer ${
                isMissingMetadata ? 'ring-2 ring-yellow-200 dark:ring-yellow-800' : ''
              }`}
            >
              <div className="relative aspect-square">
                {nft.image_url ? (
                  <img
                    src={nft.image_url}
                    alt={nft.title || `NFT #${nft.token_id}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <span className="text-gray-500 dark:text-gray-400">No Image</span>
                  </div>
                )}
                {isMissingMetadata && (
                  <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                    Missing Data
                  </div>
                )}
              </div>
              <div className="p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                  {nft.title || `NFT #${nft.token_id}`}
                </h3>
                <div className="flex flex-wrap gap-1">
                  {nft.attributes?.slice(0, 2).map((attr, i) => (
                    <span key={i} className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs text-gray-600 dark:text-gray-300">
                      {attr.trait_type}: {attr.value}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 