'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { truncateAddress } from '~/lib/truncateAddress';

interface Trade {
  id: string;
  nft_image_url?: string;
  collection_name: string;
  collection_address: string;
  token_id: string;
  price: string;
  buyer_address: string;
  seller_address: string;
  transaction_hash: string;
  created_at: string;
}

export function LatestTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLatestTrades() {
      try {
        const response = await fetch('/api/seaport/trades/recent');
        if (response.ok) {
          const data = await response.json();
          setTrades(data.trades || []);
        }
      } catch (error) {
        console.error('Error fetching latest trades:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLatestTrades();
  }, []);

  if (isLoading) {
    return (
      <section className="py-8 px-4">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Latest Trades</h2>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-300 dark:bg-gray-600 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/3"></div>
                  <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (trades.length === 0) {
    return (
      <section className="py-8 px-4">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Latest Trades</h2>
        <p className="text-gray-600 dark:text-gray-400">No recent trades yet.</p>
      </section>
    );
  }

  return (
    <section className="py-8 px-4">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Latest Trades</h2>
      <div className="space-y-4">
        {trades.map((trade) => (
          <Link
            key={trade.id}
            href={`/collection/${trade.collection_address}/nfts/${trade.token_id}`}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow duration-200 flex items-center gap-4 group"
          >
            <div className="w-16 h-16 relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
              {trade.nft_image_url ? (
                <Image
                  src={trade.nft_image_url}
                  alt={`${trade.collection_name} #${trade.token_id}`}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-200"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                  No Image
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 dark:text-white truncate">
                {trade.collection_name} #{trade.token_id}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {trade.price} ETH
                  </span>
                </div>
                <div className="text-xs mt-1">
                  Buyer: {truncateAddress(trade.buyer_address)} • Seller: {truncateAddress(trade.seller_address)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {new Date(trade.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

