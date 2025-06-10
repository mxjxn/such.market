'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, User, LogOut, ExternalLink, Wallet } from 'lucide-react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { useFrame } from '~/components/providers/FrameProvider';

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
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingNfts, setIsLoadingNfts] = useState(false);
  const [nftProcessingTime, setNftProcessingTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedWallets, setExpandedWallets] = useState<Set<number>>(new Set());
  const [loadingMoreWallets, setLoadingMoreWallets] = useState<Set<number>>(new Set());

  // Check if user is authenticated via either NextAuth or Farcaster frame
  const isAuthenticated = session || frameContext.context?.user?.fid;
  const userFid = session?.user?.fid || frameContext.context?.user?.fid;

  useEffect(() => {
    async function fetchUserProfile() {
      if (!userFid) return;

      setIsLoading(true);
      setError(null);

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
        setError(err instanceof Error ? err.message : 'Failed to load profile data');
      } finally {
        setIsLoading(false);
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

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  const toggleWalletExpansion = (walletIndex: number) => {
    const newExpanded = new Set(expandedWallets);
    if (newExpanded.has(walletIndex)) {
      newExpanded.delete(walletIndex);
    } else {
      newExpanded.add(walletIndex);
    }
    setExpandedWallets(newExpanded);
  };

  const loadMoreCollections = async (walletIndex: number, walletData: WalletNFTs) => {
    if (!userFid || !walletData.hasMoreCollections) return;

    setLoadingMoreWallets(prev => new Set(prev).add(walletIndex));

    try {
      // For now, we'll just expand the view since all collections are already loaded
      // In a future implementation, this could fetch additional pages from Alchemy
      setExpandedWallets(prev => new Set(prev).add(walletIndex));
    } catch (error) {
      console.error('Error loading more collections:', error);
    } finally {
      setLoadingMoreWallets(prev => {
        const newSet = new Set(prev);
        newSet.delete(walletIndex);
        return newSet;
      });
    }
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

        {/* Profile Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : error ? (
            <div className="text-center py-6">
              <p className="text-red-500 mb-3 text-sm">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
              >
                Try Again
              </button>
            </div>
          ) : userProfile ? (
            <div className="space-y-4">
              {/* Profile Header */}
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {userProfile.pfp_url ? (
                    <img
                      src={userProfile.pfp_url}
                      alt="Profile"
                      className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                      {userProfile.display_name || userProfile.username || 'Anonymous'}
                    </h2>
                  </div>
                  {userProfile.username && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      @{userProfile.username}
                    </p>
                  )}
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    FID: {userProfile.fid}
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded text-center">
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    {userProfile.follower_count || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Followers</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded text-center">
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    {userProfile.following_count || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Following</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded text-center">
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    {userProfile.verifications?.length || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Verified</div>
                </div>
              </div>

              {/* View on Warpcast */}
              <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                <a
                  href={`https://warpcast.com/${userProfile.username || userProfile.fid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors text-sm w-full justify-center"
                >
                  <ExternalLink className="w-3 h-3" />
                  View on Warpcast
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-500 dark:text-gray-400 mb-3 text-sm">No profile data available</p>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
              >
                Refresh
              </button>
            </div>
          )}
        </div>

        {/* NFT Holdings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">NFT Holdings</h2>
            {nftProcessingTime && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {nftProcessingTime}ms
              </span>
            )}
          </div>
          
          {isLoadingNfts ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Looking up NFTs...</span>
            </div>
          ) : walletNfts.length > 0 ? (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {walletNfts.map((walletData, walletIndex) => (
                <div key={walletIndex} className="space-y-2">
                  {/* Wallet Header with Status */}
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-600">
                    <Wallet className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {`${walletData.walletAddress.slice(0, 6)}...${walletData.walletAddress.slice(-4)}`}
                    </span>
                    
                    {/* Status Indicator */}
                    <div className="flex items-center gap-1">
                      {walletData.status === 'checking' && (
                        <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                      )}
                      {walletData.status === 'found' && (
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      )}
                      {walletData.status === 'none' && (
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      )}
                      {walletData.status === 'error' && (
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      )}
                    </div>
                    
                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {walletData.contracts.length} collections
                    </span>
                  </div>
                  
                  {/* Status Message */}
                  {walletData.message && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 px-2">
                      {walletData.message}
                      {walletData.message.includes('(cached)') && (
                        <span className="ml-1 text-blue-500">💾</span>
                      )}
                    </div>
                  )}
                  
                  {/* NFT Collections */}
                  {walletData.contracts.length > 0 && (
                    <div className="space-y-2">
                      {/* Show first 8 collections by default */}
                      {walletData.contracts.slice(0, 8).map((contract, index) => (
                        <div
                          key={contract.address}
                          className="bg-gray-50 dark:bg-gray-700 p-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                          onClick={() => {
                            // Navigate to collection page with "items you own" filter
                            window.location.href = `/collection/${contract.address}?filter=owned`;
                          }}
                        >
                          <div className="flex justify-between items-center">
                            <span className="text-gray-900 dark:text-white truncate flex-1 mr-2">
                              {contract.name || `Collection ${index + 1}`}
                            </span>
                            <span className="text-blue-600 dark:text-blue-400 font-medium">
                              {contract.totalBalance} tokens
                            </span>
                          </div>
                        </div>
                      ))}
                      
                      {/* Show remaining collections if expanded */}
                      {expandedWallets.has(walletIndex) && walletData.contracts.length > 8 && (
                        <div className="space-y-2">
                          {walletData.contracts.slice(8).map((contract, index) => (
                            <div
                              key={contract.address}
                              className="bg-gray-50 dark:bg-gray-700 p-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                              onClick={() => {
                                // Navigate to collection page with "items you own" filter
                                window.location.href = `/collection/${contract.address}?filter=owned`;
                              }}
                            >
                              <div className="flex justify-between items-center">
                                <span className="text-gray-900 dark:text-white truncate flex-1 mr-2">
                                  {contract.name || `Collection ${index + 9}`}
                                </span>
                                <span className="text-blue-600 dark:text-blue-400 font-medium">
                                  {contract.totalBalance} tokens
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Expand/Collapse and Load More buttons */}
                      <div className="flex gap-2 pt-2">
                        {walletData.contracts.length > 8 && (
                          <button
                            onClick={() => toggleWalletExpansion(walletIndex)}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                          >
                            {expandedWallets.has(walletIndex) 
                              ? 'Show less' 
                              : `Show ${walletData.contracts.length - 8} more collections`
                            }
                          </button>
                        )}
                        
                        {walletData.hasMoreCollections && (
                          <button
                            onClick={() => loadMoreCollections(walletIndex, walletData)}
                            disabled={loadingMoreWallets.has(walletIndex)}
                            className="text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                          >
                            {loadingMoreWallets.has(walletIndex) ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Loading...
                              </>
                            ) : (
                              'Load more collections'
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">
              No NFT holdings found
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 