'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import useSWR from 'swr';

interface NFT {
  id: string;
  token_id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  metadata: Record<string, unknown> | null;
  attributes: Array<{ trait_type: string; value: string | number }> | null;
  media: Array<{
    raw: string;
    gateway: string;
    thumbnail: string;
    format: string;
    bytes: number;
  }> | null;
  owner_address: string;
  last_owner_check_at: string;
}

interface FCCollectionResponse {
  nfts: NFT[];
  total: number;
  page: number;
  pageSize: number;
  isFresh: boolean;
  message?: string;
}

interface FCNFTGridProps {
  contractAddress: string;
}

// Fetcher function for SWR
const fetchFCCollection = async (url: string): Promise<FCCollectionResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('Failed to fetch FC collection') as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return res.json();
};

export default function FCNFTGrid({ contractAddress }: FCNFTGridProps) {
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Fetch FC collection data with SWR
  const { 
    data: collectionData, 
    error: collectionError,
    isLoading: isCollectionLoading,
    mutate: mutateCollection
  } = useSWR<FCCollectionResponse>(
    contractAddress ? `/api/collection/fc?contractAddress=${contractAddress}&page=${page}&pageSize=${pageSize}` : null,
    fetchFCCollection,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: (data) => data?.isFresh ? 0 : 5000 // Poll every 5 seconds if not fresh
    }
  );

  // Auto-refresh when data becomes stale
  useEffect(() => {
    if (collectionData && !collectionData.isFresh && collectionData.message) {
      const interval = setInterval(() => {
        mutateCollection();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [collectionData, mutateCollection]);

  if (isCollectionLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading Farcaster users&apos; NFTs...</p>
        </div>
      </div>
    );
  }

  if (collectionError) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading NFTs</h3>
        <p className="text-gray-600 dark:text-gray-400">
          {collectionError.message || 'Failed to load Farcaster users&apos; NFTs'}
        </p>
      </div>
    );
  }

  if (!collectionData) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Data Available</h3>
        <p className="text-gray-600 dark:text-gray-400">No Farcaster users&apos; NFTs found for this collection.</p>
      </div>
    );
  }

  const { nfts, total, isFresh, message } = collectionData;

  if (!isFresh && message) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Fetching Fresh Data</h3>
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No NFTs Found</h3>
        <p className="text-gray-600 dark:text-gray-400">
          No Farcaster users currently own NFTs from this collection.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Farcaster Users&apos; NFTs
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {total} NFTs owned by Farcaster users
          </p>
        </div>
        {!isFresh && (
          <div className="text-sm text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1 rounded-full">
            Loading fresh data...
          </div>
        )}
      </div>

      {/* NFT Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {nfts.map((nft: NFT) => (
          <div
            key={nft.id}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300"
          >
            {/* NFT Image */}
            <div className="aspect-square bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
              {nft.image_url ? (
                <img
                  src={nft.image_url}
                  alt={nft.title || `NFT #${nft.token_id}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <span>No Image</span>
                </div>
              )}
            </div>

            {/* NFT Info */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {nft.title || `NFT #${nft.token_id}`}
              </h3>
              {nft.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                  {nft.description}
                </p>
              )}
              
              {/* Owner Info */}
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Owner: {nft.owner_address.slice(0, 6)}...{nft.owner_address.slice(-4)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {total > pageSize && (
        <div className="flex justify-center items-center space-x-4 mt-8">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600"
          >
            Previous
          </button>
          <span className="text-gray-600 dark:text-gray-400">
            Page {page + 1} of {Math.ceil(total / pageSize)}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={(page + 1) * pageSize >= total}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
} 