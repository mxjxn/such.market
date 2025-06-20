'use client';

import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';
import { User, Home } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { useFrame } from '~/components/providers/FrameProvider';
import sdk from '@farcaster/frame-sdk';
import { getCsrfToken } from 'next-auth/react';

interface UserProfile {
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
}

export function TopNavigation() {
  const { data: session } = useSession();
  const frameContext = useFrame();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Check if user is authenticated via either NextAuth or Farcaster frame
  const isAuthenticated = session || frameContext.context?.user?.fid;
  const userFid = session?.user?.fid || frameContext.context?.user?.fid;

  useEffect(() => {
    async function fetchUserProfile() {
      if (!userFid) return;

      try {
        const response = await fetch(`/api/profile/${userFid}`);
        if (response.ok) {
          const profileData = await response.json();
          setUserProfile(profileData);
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      }
    }

    fetchUserProfile();
  }, [userFid]);

  const handleSignIn = useCallback(async () => {
    try {
      setIsSigningIn(true);
      const nonce = await getCsrfToken();
      if (!nonce) throw new Error("Unable to generate nonce");
      
      const result = await sdk.actions.signIn({ nonce });
      
      await signIn("credentials", {
        message: result.message,
        signature: result.signature,
        redirect: false,
      });
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  return (
    <nav className="w-full bg-gray-900/80 backdrop-blur-sm border-b border-gray-700 sticky top-0 z-40 transition-all duration-300">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side - Home button */}
          <Link 
            href="/" 
            className="flex items-center gap-2 text-white hover:text-blue-400 transition-all duration-200 hover-lift group"
          >
            <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center group-hover:bg-blue-400 transition-all duration-200 hover-lift">
              <Home className="w-4 h-4" />
            </div>
            <span className="font-semibold">CryptoArt</span>
          </Link>

          {/* Right side - Profile icon */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link
                href="/profile"
                className="flex items-center gap-2 text-white hover:text-blue-400 transition-all duration-200 hover-lift group"
              >
                {userProfile?.pfp_url || frameContext.context?.user?.pfpUrl ? (
                  <img
                    src={userProfile?.pfp_url || frameContext.context?.user?.pfpUrl}
                    alt="Profile"
                    className="w-8 h-8 rounded-full object-contain aspect-square border-2 border-gray-600 group-hover:border-blue-400 transition-all duration-200"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center group-hover:bg-gray-500 transition-all duration-200 hover-lift">
                    <User className="w-4 h-4" />
                  </div>
                )}
                <span className="hidden sm:inline text-sm">
                  {userProfile?.display_name || userProfile?.username || 
                   frameContext.context?.user?.displayName || 
                   frameContext.context?.user?.username || 
                   'Profile'}
                </span>
              </Link>
            ) : (
              <button
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="flex items-center gap-2 text-gray-400 hover:text-blue-400 transition-all duration-200 disabled:opacity-50 hover-lift group"
              >
                <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center group-hover:bg-gray-500 transition-all duration-200 hover-lift">
                  <User className="w-4 h-4" />
                </div>
                <span className="hidden sm:inline text-sm">
                  {isSigningIn ? 'Signing In...' : 'Sign In'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 