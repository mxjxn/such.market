'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Loader2, Grid, List } from 'lucide-react';
import { TraitFilter } from './TraitFilter';

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

      console.log('🔄 Starting NFT fetch request:', {
        url: url.toString(),
        method: 'GET',
        headers: {
          accept: 'application/json',
          cache: isLoadMore ? 'no-store' : 'force-cache'
        },
        page: pageNum,
        currentNFTCount: nfts.length,
        isLoadMore,
        timestamp: new Date().toISOString()
      });

      if (isLoadMore) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      console.log('📡 Initiating fetch request...');
      const response = await fetch(url, {
        cache: isLoadMore ? 'no-store' : 'force-cache',
      });
      console.log('📥 Received response:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        ok: response.ok,
        type: response.type,
        url: response.url
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Details:', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText,
          url: response.url,
          timestamp: new Date().toISOString()
        });
        
        // Handle 404 as a special case - collection not found
        if (response.status === 404) {
          setError('Collection not found. It may be initializing, please try again in a moment.');
          setNfts([]);
          setHasMore(false);
          return;
        }
        
        throw new Error(`Failed to fetch NFTs: ${response.status} ${response.statusText} - ${errorText}`);
      }

      console.log('📦 Attempting to parse response as JSON...');
      const data = await response.json();
      console.log('✅ Successfully parsed JSON response:', {
        hasData: !!data,
        dataType: typeof data,
        keys: data ? Object.keys(data) : null,
        timestamp: new Date().toISOString()
      });
      
      if (!data || typeof data !== 'object') {
        console.error('❌ Invalid API Response Structure:', {
          received: data,
          type: typeof data,
          timestamp: new Date().toISOString()
        });
        throw new Error('Invalid response format from server');
      }

      const { nfts: fetchedNFTs, total, hasMore: hasMoreNFTs } = data;
      
      if (!Array.isArray(fetchedNFTs)) {
        console.error('❌ Invalid NFT data structure:', {
          received: fetchedNFTs,
          type: typeof fetchedNFTs,
          fullResponse: data,
          timestamp: new Date().toISOString()
        });
        throw new Error('Invalid NFT data received from server');
      }

      console.log('🎉 Successfully processed NFT data:', {
        newNFTsCount: fetchedNFTs.length,
        total,
        hasMore: hasMoreNFTs,
        isLoadMore,
        firstNFT: fetchedNFTs[0] ? {
          tokenId: fetchedNFTs[0].token_id,
          hasMetadata: !!fetchedNFTs[0].metadata,
          hasMedia: !!fetchedNFTs[0].media?.length,
          title: fetchedNFTs[0].title,
          imageUrl: fetchedNFTs[0].image_url
        } : null,
        timestamp: new Date().toISOString()
      });

      if (isLoadMore) {
        // Create a Map of existing NFTs using token_id as key
        const existingNFTsMap = new Map(nfts.map(nft => [nft.token_id, nft]));
        
        // Add new NFTs to the map, overwriting any duplicates
        fetchedNFTs.forEach(nft => {
          if (nft.token_id) {
            existingNFTsMap.set(nft.token_id, nft);
          }
        });
        
        // Convert map back to array
        const uniqueNFTs = Array.from(existingNFTsMap.values());
        
        // Sort by token_id to maintain consistent order
        uniqueNFTs.sort((a, b) => {
          const aId = parseInt(a.token_id) || 0;
          const bId = parseInt(b.token_id) || 0;
          return aId - bId;
        });
        
        setNfts(uniqueNFTs);
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
      if (!nft?.attributes) return false;
      
      // Check if NFT has all selected traits
      return Object.entries(selectedTraits).every(([traitType, values]) => {
        if (values.length === 0) return true; // No values selected for this trait type
        const attribute = nft.attributes?.find(attr => attr.trait_type === traitType);
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
    if (nft.image_url) {
      const url = convertIpfsToHttps(nft.image_url);
      console.log('🔍 Image URL from metadata:', {
        original: nft.image_url,
        converted: url,
        tokenId: nft.token_id
      });
      return url;
    }
    // Then try media array
    if (nft.media?.[0]?.gateway) {
      const url = convertIpfsToHttps(nft.media[0].gateway);
      console.log('🔍 Image URL from media gateway:', {
        original: nft.media[0].gateway,
        converted: url,
        tokenId: nft.token_id
      });
      return url;
    }
    // Finally try thumbnail
    if (nft.thumbnail_url) {
      const url = convertIpfsToHttps(nft.thumbnail_url);
      console.log('🔍 Image URL from media thumbnail:', {
        original: nft.thumbnail_url,
        converted: url,
        tokenId: nft.token_id
      });
      return url;
    }
    console.log('⚠️ No image URL found for NFT:', {
      tokenId: nft.token_id,
      hasMetadata: !!nft.metadata,
      hasMedia: !!nft.media?.length,
      metadataImage: nft.image_url,
      mediaGateway: nft.media?.[0]?.gateway,
      mediaThumbnail: nft.thumbnail_url
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
              .filter(nft => Array.isArray(nft?.attributes))
              .flatMap(nft => nft.attributes || [])}
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
                {filteredNfts.map((nft, index) => {
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