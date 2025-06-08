'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Loader2, Grid, List } from 'lucide-react';
import { TraitFilter } from './TraitFilter';

interface NFT {
  tokenId: string;
  title: string;
  description: string | null;
  media: Array<{
    gateway: string;
    thumbnail: string;
    raw: string;
    format: string;
    bytes: number;
  }>;
  metadata: {
    name: string;
    description: string;
    image: string;
    attributes: Array<{
      trait_type: string;
      value: string;
    }>;
  } | null;
}

interface NFTGridProps {
  contractAddress: string;
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

export default function NFTGrid({ contractAddress }: NFTGridProps) {
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [filteredNfts, setFilteredNfts] = useState<NFT[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selectedTraits, setSelectedTraits] = useState<Record<string, string[]>>({});
  const pageSize = 20;

  const fetchNFTs = async (pageNum: number, isLoadMore: boolean = false) => {
    try {
      const url = new URL(`/api/collection/${contractAddress}/nfts`, window.location.origin);
      url.searchParams.set('page', pageNum.toString());
      url.searchParams.set('pageSize', pageSize.toString());

      console.log('🔄 Fetching NFTs:', {
        url: url.toString(),
        page: pageNum,
        currentNFTCount: nfts.length,
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
        const errorText = await response.text();
        console.error('API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Failed to fetch NFTs: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data || typeof data !== 'object') {
        console.error('Invalid API Response:', data);
        throw new Error('Invalid response format from server');
      }

      const { nfts: fetchedNFTs, total, hasMore: hasMoreNFTs } = data;
      
      if (!Array.isArray(fetchedNFTs)) {
        console.error('Invalid NFT data in response:', {
          received: fetchedNFTs,
          type: typeof fetchedNFTs,
          fullResponse: data
        });
        throw new Error('Invalid NFT data received from server');
      }

      console.log('📦 Received NFT data:', {
        newNFTsCount: fetchedNFTs.length,
        total,
        hasMore: hasMoreNFTs,
        isLoadMore,
        firstNFT: fetchedNFTs[0] ? {
          tokenId: fetchedNFTs[0].tokenId,
          hasMetadata: !!fetchedNFTs[0].metadata,
          hasMedia: !!fetchedNFTs[0].media?.length
        } : null
      });

      if (isLoadMore) {
        setNfts(prev => [...prev, ...fetchedNFTs]);
      } else {
        setNfts(fetchedNFTs);
      }
      
      setHasMore(hasMoreNFTs);
      setPage(pageNum);
    } catch (err) {
      const errorDetails = {
        name: err instanceof Error ? err.name : 'Unknown',
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        contractAddress,
        page: pageNum,
        isLoadMore,
        timestamp: new Date().toISOString()
      };
      
      console.error('❌ Error in NFTGrid:', errorDetails);
      setError(errorDetails.message);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Load initial NFTs
  useEffect(() => {
    fetchNFTs(0);
  }, [contractAddress]);

  // Filter NFTs based on selected traits
  useEffect(() => {
    if (!Array.isArray(nfts)) {
      console.warn('NFTs is not an array:', nfts);
      setFilteredNfts([]);
      return;
    }

    if (Object.keys(selectedTraits).length === 0) {
      setFilteredNfts(nfts);
      return;
    }

    const filtered = nfts.filter(nft => {
      if (!nft?.metadata?.attributes) return false;
      
      // Check if NFT has all selected traits
      return Object.entries(selectedTraits).every(([traitType, values]) => {
        if (values.length === 0) return true; // No values selected for this trait type
        const attribute = nft.metadata?.attributes?.find(attr => attr.trait_type === traitType);
        return attribute && values.includes(attribute.value);
      });
    });

    setFilteredNfts(filtered);
  }, [nfts, selectedTraits]);

  const handleTraitChange = (traitType: string, value: string, checked: boolean) => {
    setSelectedTraits(prev => {
      const currentValues = prev[traitType] || [];
      const newValues = checked
        ? [...currentValues, value]
        : currentValues.filter(v => v !== value);
      
      return {
        ...prev,
        [traitType]: newValues
      };
    });
  };

  // Load more NFTs
  const loadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchNFTs(page + 1, true);
    }
  };

  const getImageUrl = (nft: NFT) => {
    // Try to get image from metadata first
    if (nft.metadata?.image) {
      const url = convertIpfsToHttps(nft.metadata.image);
      console.log('🔍 Image URL from metadata:', {
        original: nft.metadata.image,
        converted: url,
        tokenId: nft.tokenId
      });
      return url;
    }
    // Then try media array
    if (nft.media?.[0]?.gateway) {
      const url = convertIpfsToHttps(nft.media[0].gateway);
      console.log('🔍 Image URL from media gateway:', {
        original: nft.media[0].gateway,
        converted: url,
        tokenId: nft.tokenId
      });
      return url;
    }
    // Finally try thumbnail
    if (nft.media?.[0]?.thumbnail) {
      const url = convertIpfsToHttps(nft.media[0].thumbnail);
      console.log('🔍 Image URL from media thumbnail:', {
        original: nft.media[0].thumbnail,
        converted: url,
        tokenId: nft.tokenId
      });
      return url;
    }
    console.log('⚠️ No image URL found for NFT:', {
      tokenId: nft.tokenId,
      hasMetadata: !!nft.metadata,
      hasMedia: !!nft.media?.length,
      metadataImage: nft.metadata?.image,
      mediaGateway: nft.media?.[0]?.gateway,
      mediaThumbnail: nft.media?.[0]?.thumbnail
    });
    return null;
  };

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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">NFTs</h2>
        <ViewSwitcher view={view} onViewChange={setView} />
      </div>

      <div className="flex gap-6">
        {/* Trait Filter Sidebar */}
        {Array.isArray(nfts) && nfts.length > 0 && (
          <TraitFilter
            traits={nfts
              .filter(nft => Array.isArray(nft?.metadata?.attributes))
              .flatMap(nft => nft.metadata?.attributes || [])}
            selectedTraits={selectedTraits}
            onTraitChange={handleTraitChange}
          />
        )}

        {/* NFT Grid/List */}
        <div className="flex-1">
          {isLoading ? (
            <div className="flex justify-center items-center min-h-[200px]">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : error ? (
            <div className="text-center text-red-500">{error}</div>
          ) : !Array.isArray(filteredNfts) || filteredNfts.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No NFTs found
            </div>
          ) : (
            <>
              <div className={view === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-4'}>
                {filteredNfts.map((nft) => {
                  if (!nft) return null;
                  const imageUrl = getImageUrl(nft);
                  const uniqueKey = `${contractAddress}-${nft.tokenId}`;
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
                            alt={nft.title || `NFT #${nft.tokenId}`}
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
                          {nft.title || `NFT #${nft.tokenId}`}
                        </h3>
                        {nft.metadata?.attributes && nft.metadata.attributes.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {nft.metadata.attributes.slice(0, 2).map((attr, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                              >
                                {attr.trait_type}: {attr.value}
                              </span>
                            ))}
                            {nft.metadata.attributes.length > 2 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                +{nft.metadata.attributes.length - 2} more
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
              {hasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <span>Load More</span>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
} 