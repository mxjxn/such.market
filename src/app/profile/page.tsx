'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, User, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { useFrame } from '~/components/providers/FrameProvider';
import ProfileHeader from '~/components/ProfileHeader';
import NftHoldings from '~/components/NftHoldings';

interface UserProfile {
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
  follower_count?: number;
  following_count?: number;
  verifications?: string[];
}

interface WalletNFTs {
  walletAddress: string;
  contracts: {
    address: string;
    totalBalance: number;
    numDistinctTokensOwned: number;
    isSpam: boolean;
    name?: string;
  }[];
  status: 'checking' | 'found' | 'none' | 'error';
  message?: string;
  hasMoreCollections?: boolean;
  totalCollectionsFound?: number;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const frameContext = useFrame();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [walletNfts, setWalletNfts] = useState<WalletNFTs[]>([]);
  const [isLoadingNfts, setIsLoadingNfts] = useState(false);
  const [nftProcessingTime, setNftProcessingTime] = useState<number | null>(null);

  // Check if user is authenticated via either NextAuth or Farcaster frame
  const isAuthenticated = session || frameContext.context?.user?.fid;
  const userFid = session?.user?.fid || frameContext.context?.user?.fid;

  useEffect(() => {
    async function fetchUserProfile() {
      if (!userFid) return;

      try {
        const response = await fetch(`/api/profile/${userFid}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || errorData.error || 'Failed to fetch profile');
        }

        const profileData = await response.json();
        setUserProfile(profileData);
      } catch (err) {
        console.error('Error fetching user profile:', err);
      }
    }

    fetchUserProfile();
  }, [userFid]);

  useEffect(() => {
    async function fetchNFTContracts() {
      if (!userFid) return;

      setIsLoadingNfts(true);
      setNftProcessingTime(null);

      try {
        const response = await fetch(`/api/nft-contracts/${userFid}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || errorData.error || 'Failed to fetch NFT contracts');
        }

        const nftData = await response.json();
        
        // The API now returns wallets with their contracts and status
        const walletNftsArray: WalletNFTs[] = nftData.wallets || [];
        
        setWalletNfts(walletNftsArray);
        setNftProcessingTime(nftData.processingTime || null);
      } catch (err) {
        console.error('Error fetching NFT contracts:', err);
        // Don't set error state for NFT loading as it's not critical
      } finally {
        setIsLoadingNfts(false);
      }
    }

    fetchNFTContracts();
  }, [userFid]);

  const handleLoadMoreCollections = async (walletAddress: string, pageKey?: string) => {
    if (!userFid) return;

    try {
      // Call the API with pagination parameters
      const params = new URLSearchParams({
        walletAddress,
        ...(pageKey && { pageKey })
      });

      const response = await fetch(`/api/nft-contracts/${userFid}?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to load more collections');
      }

      const nftData = await response.json();
      
      // Update the specific wallet's data
      setWalletNfts(prevWallets => 
        prevWallets.map(wallet => 
          wallet.walletAddress === walletAddress 
            ? {
                ...wallet,
                contracts: [...wallet.contracts, ...(nftData.wallets?.[0]?.contracts || [])],
                hasMoreCollections: nftData.wallets?.[0]?.hasMoreCollections || false,
                pageKey: nftData.wallets?.[0]?.pageKey,
                totalCollectionsFound: wallet.totalCollectionsFound + (nftData.wallets?.[0]?.contracts?.length || 0),
                message: `Found ${wallet.totalCollectionsFound + (nftData.wallets?.[0]?.contracts?.length || 0)} NFT collection(s)${nftData.wallets?.[0]?.hasMoreCollections ? ' (more available)' : ' (complete)'}`
              }
            : wallet
        )
      );
    } catch (err) {
      console.error('Error loading more collections:', err);
      // Could add a toast notification here
    }
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  // Show sign-in prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <User className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Sign In Required</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Please sign in with Farcaster to view your profile.
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-sm mx-auto space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Profile</h1>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm"
          >
            <LogOut className="w-3 h-3" />
            Sign Out
          </button>
        </div>

        {/* Profile Header (new) */}
        {userProfile && (
          <ProfileHeader
            pfp_url={userProfile.pfp_url}
            username={userProfile.username}
            display_name={userProfile.display_name}
            fid={userProfile.fid}
          />
        )}

        {/* NFT Holdings (new) */}
        <NftHoldings
          walletNfts={walletNfts}
          isLoading={isLoadingNfts}
          nftProcessingTime={nftProcessingTime}
          onLoadMore={handleLoadMoreCollections}
        />
      </div>
    </div>
  );
} 