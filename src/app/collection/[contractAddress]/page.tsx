'use client';

import { useEffect, useState, memo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import { NFTGrid } from '../../../components/NFTGrid';
import { FCNFTGrid } from '../../../components/FCNFTGrid';
import { OwnedNFTGrid } from '../../../components/OwnedNFTGrid';
import { SearchBar } from '../../../components/SearchBar';
import useSWR from 'swr';

// Custom error type for API errors
interface APIError extends Error {
  info?: {
    error?: string;
    [key: string]: unknown;
  };
  status?: number;
}

// Move RefreshButton outside and memoize it
const RefreshButton = memo(function RefreshButton({ 
  refreshStatus,
  onRefresh
}: { 
  refreshStatus: { canRefresh: boolean; nextRefreshTime: string | null; remainingTime: number } | null;
  onRefresh: () => Promise<void>;
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!refreshStatus?.canRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!refreshStatus) return null;

  return (
    <button
      onClick={handleRefresh}
      disabled={!refreshStatus.canRefresh || isRefreshing}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
        refreshStatus.canRefresh && !isRefreshing
          ? 'bg-blue-500 hover:bg-blue-600 text-white'
          : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
      }`}
    >
      {isRefreshing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <RefreshCw className="w-4 h-4" />
      )}
      {refreshStatus.canRefresh
        ? 'Refresh Collection'
        : `Next refresh in ${Math.ceil(refreshStatus.remainingTime)}m`}
    </button>
  );
});

// Fetcher functions for SWR
const fetchCollection = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('Failed to fetch collection') as APIError;
    error.info = await res.json();
    error.status = res.status;
    throw error;
  }
  return res.json();
};

const fetchRefreshStatus = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error('Failed to fetch refresh status') as APIError;
    error.info = await res.json();
    error.status = res.status;
    throw error;
  }
  return res.json();
};

export default function CollectionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const contractAddress = params.contractAddress as string;
  const [viewMode, setViewMode] = useState<'all' | 'fc' | 'owned'>('all');

  // State to track if we're waiting for refresh
  const [isPopulating, setIsPopulating] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // Check for filter parameter in URL
  useEffect(() => {
    const filter = searchParams.get('filter');
    if (filter === 'owned') {
      setViewMode('owned');
    } else if (filter === 'fc') {
      setViewMode('fc');
    } else {
      setViewMode('all');
    }
  }, [searchParams]);

  // Function to update URL when view mode changes
  const updateViewMode = (mode: 'all' | 'fc' | 'owned') => {
    setViewMode(mode);
    const newSearchParams = new URLSearchParams(searchParams);
    
    if (mode === 'owned') {
      newSearchParams.set('filter', 'owned');
    } else if (mode === 'fc') {
      newSearchParams.set('filter', 'fc');
    } else {
      newSearchParams.delete('filter');
    }
    
    const newUrl = `${window.location.pathname}?${newSearchParams.toString()}`;
    router.replace(newUrl);
  };

  // Fetch collection data with SWR
  const { 
    data: collectionData, 
    error: collectionError,
    isLoading: isCollectionLoading,
    mutate: mutateCollection
  } = useSWR(
    contractAddress ? `/api/collection/${contractAddress}` : null,
    fetchCollection,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false
    }
  );

  // Fetch refresh status with SWR
  const { 
    data: refreshStatus,
    mutate: mutateRefreshStatus
  } = useSWR(
    contractAddress ? `/api/collection/${contractAddress}/refresh` : null,
    fetchRefreshStatus,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 60000 // Check refresh status every minute
    }
  );

  // Polling interval for checking if collection is available
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPopulating) {
      interval = setInterval(() => {
        mutateCollection();
      }, 3000); // Poll every 3 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPopulating, mutateCollection]);

  // If collectionError is 404, trigger refresh
  useEffect(() => {
    if (collectionError && collectionError.status === 404 && !isPopulating) {
      setIsPopulating(true);
      setRefreshError(null);
      fetch(`/api/collection/${contractAddress}/refresh`, { method: 'POST' })
        .then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to refresh collection');
          }
        })
        .catch((err) => {
          setRefreshError(err.message || 'Failed to refresh collection');
        });
    }
    // If collectionData becomes available, stop populating
    if (collectionData && isPopulating) {
      setIsPopulating(false);
    }
  }, [collectionError, isPopulating, contractAddress, collectionData]);

  const handleRefresh = async () => {
    if (!refreshStatus?.canRefresh) return;

    try {
      const response = await fetch(`/api/collection/${contractAddress}/refresh`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to refresh collection');
      }

      // Refresh both collection data and refresh status
      await Promise.all([
        mutateCollection(),
        mutateRefreshStatus()
      ]);

      // Refresh the page to show new data
      window.location.reload();
    } catch (error) {
      console.error('Error refreshing collection:', error);
    }
  };

  if (isCollectionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Show loading state if we're populating the collection
  if (isPopulating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Populating Collection...</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            We&apos;re loading this collection for the first time. This may take a few moments.
          </p>
          {refreshError && (
            <p className="text-red-500">{refreshError}</p>
          )}
        </div>
      </div>
    );
  }

  if (collectionError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {collectionError.info?.error || collectionError.message}
          </p>
        </div>
      </div>
    );
  }

  if (!collectionData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Collection Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400">The requested collection could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 fade-in">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Search Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 slide-up">
          <SearchBar />
        </div>

        {/* Collection Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 slide-up">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {collectionData.name || 'Unnamed Collection'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Contract: {contractAddress}
              </p>
            </div>
            <RefreshButton 
              refreshStatus={refreshStatus}
              onRefresh={handleRefresh}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-600">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Supply</h2>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {collectionData.totalSupply || 'Unknown'}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-600">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Token Type</h2>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  collectionData.token_type === 'ERC721' 
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                    : collectionData.token_type === 'ERC1155'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200'
                }`}>
                  {collectionData.token_type || 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 slide-up">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">NFTs</h2>
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => updateViewMode('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  viewMode === 'all'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                All NFTs
              </button>
              <button
                onClick={() => updateViewMode('fc')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  viewMode === 'fc'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Farcaster Users
              </button>
              <button
                onClick={() => updateViewMode('owned')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                  viewMode === 'owned'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Items You Own
              </button>
            </div>
          </div>

          {/* NFT Grid */}
          <div className="scale-in">
            {viewMode === 'all' ? (
              <NFTGrid contractAddress={contractAddress} />
            ) : viewMode === 'fc' ? (
              <FCNFTGrid contractAddress={contractAddress} />
            ) : (
              <OwnedNFTGrid contractAddress={contractAddress} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}