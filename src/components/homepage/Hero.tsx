'use client';

import { useSession } from 'next-auth/react';
import { useFrame } from '~/components/providers/FrameProvider';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface SiteSettings {
  hero_cta_authenticated?: string;
  hero_cta_unauthenticated?: string;
}

export function Hero() {
  const { data: session } = useSession();
  const frameContext = useFrame();
  const [settings, setSettings] = useState<SiteSettings>({});
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = session || frameContext.context?.user?.fid;

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/admin/site-settings');
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        }
      } catch (error) {
        console.error('Error fetching site settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, []);

  const ctaText = isAuthenticated
    ? (settings.hero_cta_authenticated || 'Climb the leaderboard!')
    : (settings.hero_cta_unauthenticated || 'Claim your profile');

  const ctaLink = isAuthenticated ? '/profile' : '/';

  if (isLoading) {
    return (
      <section className="text-center space-y-6 py-12 px-4">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto mb-4"></div>
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto"></div>
        </div>
      </section>
    );
  }

  return (
    <section className="text-center space-y-6 py-12 px-4">
      <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
        Welcome to {process.env.NEXT_PUBLIC_FRAME_NAME || 'CryptoArt'}
      </h1>
      <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
        Browse and trade NFTs on Base
      </p>
      <div className="pt-4">
        <Link
          href={ctaLink}
          className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors duration-200 shadow-lg hover:shadow-xl"
        >
          {ctaText}
        </Link>
      </div>
    </section>
  );
}

