'use client';

import { useQuery } from '@tanstack/react-query';
import { useNFTTransition } from './NFTTransition';

interface NFT {
  id: string;
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

interface FCNFTGridProps {
  contractAddress: string;
}

export function FCNFTGrid({ contractAddress }: FCNFTGridProps) {
  const { navigateToNFT } = useNFTTransition();

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['fc-nfts', contractAddress],
    queryFn: async () => {
      const response = await fetch(`/api/collection/fc/nfts?contractAddress=${contractAddress}`);
      if (!response.ok) {
        throw new Error('Failed to fetch Farcaster NFTs');
      }
      return response.json();
    },
  });

  const nfts = response?.nfts || [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
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
        <p className="text-red-500">Error loading Farcaster NFTs: {error.message}</p>
      </div>
    );
  }

  if (!nfts || nfts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No Farcaster users own NFTs from this collection.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {nfts.map((nft: NFT) => (
        <div
          key={nft.id}
          onClick={() => navigateToNFT(contractAddress, nft.token_id)}
          className="block bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden card-hover nft-card cursor-pointer"
        >
          {/* NFT Image */}
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
          </div>

          {/* NFT Info */}
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
      ))}
    </div>
  );
} 