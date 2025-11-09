'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface FeaturedCollection {
  id: string;
  contract_address: string;
  name: string;
  image_url?: string;
  floor_price?: string;
  volume_24h?: string;
  featured: boolean;
}

export function FeaturedCollections() {
  const [collections, setCollections] = useState<FeaturedCollection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchFeaturedCollections() {
      try {
        const response = await fetch('/api/collections/featured');
        if (response.ok) {
          const data = await response.json();
          setCollections(data.collections || []);
        }
      } catch (error) {
        console.error('Error fetching featured collections:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchFeaturedCollections();
  }, []);

  if (isLoading) {
    return (
      <section className="py-8 px-4">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Featured Collections</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4 animate-pulse">
              <div className="aspect-square bg-gray-300 dark:bg-gray-600 rounded mb-3"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
              <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (collections.length === 0) {
    return (
      <section className="py-8 px-4">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Featured Collections</h2>
        <p className="text-gray-600 dark:text-gray-400">No featured collections yet.</p>
      </section>
    );
  }

  return (
    <section className="py-8 px-4">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Featured Collections</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {collections.map((collection) => (
          <Link
            key={collection.id}
            href={`/collection/${collection.contract_address}`}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow duration-200 group"
          >
            <div className="aspect-square relative mb-3 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
              {collection.image_url ? (
                <Image
                  src={collection.image_url}
                  alt={collection.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-200"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  No Image
                </div>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1 truncate">
              {collection.name}
            </h3>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              {collection.floor_price && (
                <div>Floor: {collection.floor_price} ETH</div>
              )}
              {collection.volume_24h && (
                <div>24h Vol: {collection.volume_24h} ETH</div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

