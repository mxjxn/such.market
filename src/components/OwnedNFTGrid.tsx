'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useFrame } from '~/components/providers/FrameProvider';
import { useNFTTransition } from './NFTTransition';
import { useEffect, useState } from 'react';

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
  balance?: number;
  owner_address?: string;
}

interface OwnedNFTGridProps {
  contractAddress: string;
}

export function OwnedNFTGrid({ contractAddress }: OwnedNFTGridProps) {
  const { navigateToNFT } = useNFTTransition();
  const { data: session } = useSession();
  const frameContext = useFrame();
  const [userAddress, setUserAddress] = useState<string | null>(null);

  // Get user address from session or frame context
  useEffect(() => {
    const getUserAddress = async () => {
      const userFid = session?.user?.fid || frameContext.context?.user?.fid;
      if (!userFid) {
        setUserAddress(null);
        return;
      }

      try {
        const response = await fetch(`/api/nft-contracts/${userFid}`);
        if (response.ok) {
          const data = await response.json();
          // Get the first wallet address
          if (data.wallets && data.wallets.length > 0) {
            setUserAddress(data.wallets[0].walletAddress);
          }
        }
      } catch (error) {
        console.error('Error fetching user wallet addresses:', error);
        setUserAddress(null);
      }
    };

    getUserAddress();
  }, [session?.user?.fid, frameContext.context?.user?.fid]);

  const { data: response, isLoading, error } = useQuery({
    queryKey: ['owned-nfts', contractAddress, userAddress],
    queryFn: async () => {
      if (!userAddress) {
        throw new Error('No user address available');
      }
      const response = await fetch(`/api/collection/${contractAddress}/nfts/owned?userAddress=${userAddress}`);
      if (!response.ok) {
        throw new Error('Failed to fetch owned NFTs');
      }
      return response.json();
    },
    enabled: !!userAddress, // Only run query when we have a user address
  });

  const nfts = response?.nfts || [];

  if (!userAddress) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Please connect your wallet to view owned NFTs.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
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
        <p className="text-red-500">Error loading owned NFTs: {error.message}</p>
      </div>
    );
  }

  if (!nfts || nfts.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">You don&apos;t own any NFTs from this collection.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {nfts.map((nft: NFT) => {
        const uniqueKey = `${contractAddress}-${nft.token_id}`;
        
        return (
          <div
            key={uniqueKey}
            onClick={() => navigateToNFT(contractAddress, nft.token_id)}
            className="block bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden card-hover nft-card cursor-pointer"
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
            </div>
            <div className="p-4 space-y-2">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {nft.title || `NFT #${nft.token_id}`}
              </h3>
              
              {/* Balance for ERC-1155 tokens */}
              {nft.balance && nft.balance > 1 && (
                <div className="flex items-center gap-2">
                  <span className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 px-2 py-1 rounded text-xs font-medium">
                    Balance: {nft.balance}
                  </span>
                </div>
              )}
              
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
  );
} 