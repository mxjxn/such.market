'use client';

import { useEffect, useState, memo } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import NFTGrid from '../../../components/NFTGrid';
import { SearchBar } from '../../../components/SearchBar';

interface CollectionData {
  name: string | null;
  symbol: string | null;
  totalSupply: string | null;
  contractType: 'ERC721' | 'ERC1155' | 'UNKNOWN';
  error?: string;
}

// Move RefreshButton outside and memoize it
const RefreshButton = memo(function RefreshButton({ contractAddress }: { contractAddress: string }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<{
    canRefresh: boolean;
    nextRefreshTime: string | null;
    remainingTime: number;
  } | null>(null);

  // Only check refresh status when component mounts
  useEffect(() => {
    let mounted = true;
    async function checkRefreshStatus() {
      try {
        const response = await fetch(`/api/collection/${contractAddress}/refresh`);
        if (response.ok && mounted) {
          const data = await response.json();
          setRefreshStatus(data);
        }
      } catch (error) {
        console.error('Error checking refresh status:', error);
      }
    }

    checkRefreshStatus();
    return () => {
      mounted = false;
    };
  }, [contractAddress]);

  const handleRefresh = async () => {
    if (!refreshStatus?.canRefresh || isRefreshing) return;

    setIsRefreshing(true);
    try {
      // Check refresh status before attempting refresh
      const statusResponse = await fetch(`/api/collection/${contractAddress}/refresh`);
      const statusData = await statusResponse.json();
      
      if (!statusData.canRefresh) {
        setRefreshStatus(statusData);
        return;
      }

      const response = await fetch(`/api/collection/${contractAddress}/refresh`, {
        method: 'POST',
      });

      const data = await response.json();
      
      if (response.ok) {
        // Update status immediately with the new lock time
        setRefreshStatus({
          canRefresh: false,
          nextRefreshTime: data.nextRefreshTime,
          remainingTime: Math.ceil((new Date(data.nextRefreshTime).getTime() - Date.now()) / 60000),
        });
        // Refresh the page to show new data
        window.location.reload();
      } else {
        // Update status with error message from server
        setRefreshStatus({
          canRefresh: false,
          nextRefreshTime: data.nextRefreshTime,
          remainingTime: Math.ceil((new Date(data.nextRefreshTime).getTime() - Date.now()) / 60000),
        });
      }
    } catch (error) {
      console.error('Error refreshing collection:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!refreshStatus) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleRefresh}
        disabled={!refreshStatus.canRefresh || isRefreshing}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg
          ${refreshStatus.canRefresh && !isRefreshing
            ? 'bg-blue-500 hover:bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }
          transition-colors duration-200
        `}
      >
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? 'Refreshing...' : 'Refresh Collection'}
      </button>
      {!refreshStatus.canRefresh && refreshStatus.remainingTime > 0 && (
        <span className="text-sm text-gray-500">
          Next refresh in {refreshStatus.remainingTime} minutes
        </span>
      )}
    </div>
  );
});

export default function CollectionPage() {
  const params = useParams();
  const [collectionData, setCollectionData] = useState<CollectionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCollectionData() {
      if (!params.contractAddress || typeof params.contractAddress !== 'string') {
        setError('Invalid contract address');
        setIsLoading(false);
        return;
      }

      try {
        // Fetch metadata from our API route instead of Alchemy directly
        const response = await fetch(`/api/collection/${params.contractAddress}/metadata`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch collection data');
        }
        
        const metadata = await response.json();
        
        // Store collection name in Redis if we have one and it's not already stored
        if (metadata.name) {
          try {
            // First check if collection exists
            const checkResponse = await fetch('/api/collection-exists', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                address: params.contractAddress.toLowerCase(),
              }),
            });
            
            const { exists } = await checkResponse.json();
            
            if (!exists) {
              const storeResponse = await fetch('/api/store-collection', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name: metadata.name,
                  address: params.contractAddress.toLowerCase(),
                }),
              });
              
              if (!storeResponse.ok) {
                const errorData = await storeResponse.json().catch(() => ({}));
                console.warn('Failed to store collection name:', errorData.error || storeResponse.statusText);
              }
            }
          } catch (err) {
            console.warn('Error checking/storing collection name:', err);
          }
        }

        setCollectionData(metadata);
      } catch (err) {
        console.error('Error fetching collection data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load collection data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchCollectionData();
  }, [params.contractAddress]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
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
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Search Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <SearchBar />
        </div>

        {/* Collection Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {collectionData.name || 'Unnamed Collection'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Contract: {params.contractAddress}
              </p>
            </div>
            <RefreshButton contractAddress={params.contractAddress as string} />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Symbol</h2>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {collectionData.symbol || 'N/A'}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Supply</h2>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {collectionData.totalSupply || 'N/A'}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Contract Type</h2>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {collectionData.contractType}
              </p>
            </div>
          </div>
        </div>

        {/* NFT Grid */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <NFTGrid contractAddress={params.contractAddress as string} />
        </div>
      </div>
    </div>
  );
}