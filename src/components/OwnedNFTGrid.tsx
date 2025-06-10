'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Loader2, Grid, List } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useFrame } from '~/components/providers/FrameProvider';

interface NFT {
  id: string;
  collection_id: string;
  token_id: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  metadata: {
    name: string;
    description: string;
    image: string;
    attributes: Array<{
      trait_type: string;
      value: string;
    }>;
  } | null;
  attributes: Array<{
    trait_type: string;
    value: string;
  }> | null;
  media: Array<{
    gateway: string;
    thumbnail: string;
    raw: string;
    format: string;
    bytes: number;
  }> | null;
  owner_address: string | null;
  last_owner_check_at: string | null;
  created_at: string;
  updated_at: string;
}

interface OwnedNFTGridProps {
  contractAddress: string;
  userAddress?: string;
}

// Helper function to convert IPFS URLs to HTTPS URLs
function convertIpfsToHttps(url: string | null): string | null {
  if (!url) return null;
  
  // If it's already an HTTPS URL, return as is
  if (url.startsWith('http')) return url;
  
  // Handle ipfs:// URLs
  if (url.startsWith('ipfs://')) {
    // Remove ipfs:// prefix and use infura gateway
    const ipfsHash = url.replace('ipfs://', '');
    return `https://ipfs.infura.io/ipfs/${ipfsHash}`;
  }
  
  // Handle /ipfs/ URLs
  if (url.startsWith('/ipfs/')) {
    return `https://ipfs.infura.io${url}`;
  }
  
  return url;
}

// Add ViewSwitcher component
function ViewSwitcher({ view, onViewChange }: { view: 'grid' | 'list', onViewChange: (view: 'grid' | 'list') => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onViewChange('grid')}
        className={`
          p-2 rounded-lg transition-colors duration-200
          ${view === 'grid' 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
          }
        `}
        aria-label="Grid view"
      >
        <Grid className="w-5 h-5" />
      </button>
      <button
        onClick={() => onViewChange('list')}
        className={`
          p-2 rounded-lg transition-colors duration-200
          ${view === 'list' 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
          }
        `}
        aria-label="List view"
      >
        <List className="w-5 h-5" />
      </button>
    </div>
  );
}

export default function OwnedNFTGrid({ contractAddress, userAddress }: OwnedNFTGridProps) {
  const { data: session } = useSession();
  const frameContext = useFrame();
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [isFresh, setIsFresh] = useState(true);
  const [fetchMessage, setFetchMessage] = useState<string | null>(null);
  const pageSize = 20;

  // Get user address from session or frame context
  const [userWalletAddress, setUserWalletAddress] = useState<string | null>(null);

  // Fetch user's wallet addresses when we have a FID
  useEffect(() => {
    const fetchUserWalletAddress = async () => {
      const userFid = session?.user?.fid || frameContext.context?.user?.fid;
      if (!userFid) return;

      try {
        const response = await fetch(`/api/nft-contracts/${userFid}`);
        if (response.ok) {
          const data = await response.json();
          // Get the first wallet address from the first wallet
          if (data.wallets && data.wallets.length > 0) {
            setUserWalletAddress(data.wallets[0].walletAddress);
          }
        }
      } catch (error) {
        console.error('Error fetching user wallet addresses:', error);
      }
    };

    fetchUserWalletAddress();
  }, [session?.user?.fid, frameContext.context?.user?.fid]);

  // Use the resolved user address
  const resolvedUserAddress = userAddress || userWalletAddress;

  const fetchOwnedNFTs = async (pageNum: number, isLoadMore: boolean = false) => {
    if (!resolvedUserAddress) {
      setError('No user address available');
      setIsLoading(false);
      return;
    }

    try {
      const url = new URL(`/api/collection/${contractAddress}/nfts/owned`, window.location.origin);
      url.searchParams.set('userAddress', resolvedUserAddress);
      url.searchParams.set('page', pageNum.toString());
      url.searchParams.set('pageSize', pageSize.toString());

      console.log('🔄 Starting owned NFT fetch request:', {
        url: url.toString(),
        userAddress: resolvedUserAddress,
        page: pageNum,
        isLoadMore,
      });

      if (isLoadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      const response = await fetch(url, {
        cache: isLoadMore ? 'no-store' : 'force-cache',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch owned NFTs');
      }

      const data = await response.json();
      console.log('📥 Received owned NFT data:', {
        count: data.nfts?.length ?? 0,
        hasMore: data.hasMore,
        total: data.total,
        page: pageNum,
        isLoadMore,
        isFresh: data.isFresh,
        message: data.message,
      });

      if (isLoadMore) {
        setNfts(prev => [...prev, ...(data.nfts || [])]);
      } else {
        setNfts(data.nfts || []);
      }

      setHasMore(data.hasMore ?? false);
      setIsFresh(data.isFresh ?? true);
      setFetchMessage(data.message || null);
      setError(null);
    } catch (err) {
      console.error('❌ Error fetching owned NFTs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch owned NFTs');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Load initial NFTs
  useEffect(() => {
    if (resolvedUserAddress) {
      fetchOwnedNFTs(0);
    }
  }, [contractAddress, resolvedUserAddress]);

  const getImageUrl = (nft: NFT) => {
    // Try to get image from metadata first
    if (nft.image_url) {
      const url = convertIpfsToHttps(nft.image_url);
      return url;
    }
    // Then try media array
    if (nft.media?.[0]?.gateway) {
      const url = convertIpfsToHttps(nft.media[0].gateway);
      return url;
    }
    // Finally try thumbnail
    if (nft.thumbnail_url) {
      const url = convertIpfsToHttps(nft.thumbnail_url);
      return url;
    }
    return null;
  };

  if (!resolvedUserAddress) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">Please connect your wallet to view owned NFTs</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your NFTs</h2>
          <p className="text-gray-600 dark:text-gray-400">
            NFTs you own in this collection
          </p>
        </div>
        <ViewSwitcher view={view} onViewChange={setView} />
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              {fetchMessage || 'Loading your NFTs...'}
            </p>
          </div>
        </div>
      ) : nfts.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          <p>You don&apos;t own any NFTs from this collection</p>
          {!isFresh && (
            <p className="text-sm mt-2 text-yellow-600">
              Note: Data may be outdated. Please try refreshing.
            </p>
          )}
        </div>
      ) : (
        <>
          {!isFresh && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ Data may be outdated. {fetchMessage}
              </p>
            </div>
          )}
          <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-4'}>
            {nfts.map((nft, index) => {
              if (!nft) return null;
              const imageUrl = getImageUrl(nft);
              const uniqueKey = `${contractAddress}-${nft.token_id || `index-${index}`}`;
              const isIpfsUrl = imageUrl?.includes('ipfs') ?? false;
              
              return (
                <div
                  key={uniqueKey}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300"
                >
                  <div className="relative aspect-square">
                    {imageUrl ? (
                      <Image
                        src={imageUrl}
                        alt={nft.title || `NFT #${nft.token_id}`}
                        fill
                        className="object-cover"
                        unoptimized={isIpfsUrl}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                        <span className="text-gray-400 dark:text-gray-500">No image</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                      {nft.title || `NFT #${nft.token_id}`}
                    </h3>
                    {nft.attributes && nft.attributes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {nft.attributes.slice(0, 2).map((attr, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          >
                            {attr.trait_type}: {attr.value}
                          </span>
                        ))}
                        {nft.attributes.length > 2 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                            +{nft.attributes.length - 2} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More Button */}
          {!isLoading && !error && hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={() => {
                  const nextPage = page + 1;
                  setPage(nextPage);
                  fetchOwnedNFTs(nextPage, true);
                }}
                disabled={isLoadingMore}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
} 