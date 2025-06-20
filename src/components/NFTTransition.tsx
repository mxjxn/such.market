'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface NFTTransitionProps {
  children: ReactNode;
  nftId?: string;
  contractAddress?: string;
  className?: string;
}

export function NFTTransition({ children, nftId, contractAddress, className = '' }: NFTTransitionProps) {
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // If we have NFT data, we're on the NFT page - trigger transition in
    if (nftId && contractAddress) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setIsTransitioning(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [nftId, contractAddress]);

  return (
    <div 
      className={`transition-all duration-500 ease-out ${
        isTransitioning 
          ? 'scale-105 opacity-90' 
          : 'scale-100 opacity-100'
      } ${className}`}
    >
      {children}
    </div>
  );
}

// Hook for handling NFT card clicks with smooth transitions
export function useNFTTransition() {
  const router = useRouter();

  const navigateToNFT = (contractAddress: string, tokenId: string) => {
    // Add a small delay to allow for transition animation
    setTimeout(() => {
      router.push(`/collection/${contractAddress}/nfts/${tokenId}`);
    }, 150);
  };

  return { navigateToNFT };
} 