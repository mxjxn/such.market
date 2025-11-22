"use client";

/**
 * Sell Options Component
 * Presents users with two selling options:
 * 1. List for Sale (Seaport listing) - Set your price, wait for buyer
 * 2. Sell Now (LSSVM pool) - Instant sale at current pool price
 */

import { useState, useEffect } from 'react';
import type { BestPriceResult } from '~/lib/lssvm/types';

interface SellOptionsProps {
  nft: string;
  tokenId: string;
  onOptionSelected: (option: 'list' | 'instant', price?: string) => void;
}

export function SellOptions({ nft, tokenId, onOptionSelected }: SellOptionsProps) {
  const [poolPrice, setPoolPrice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listPrice, setListPrice] = useState<string>('');

  useEffect(() => {
    fetchPoolPrice();
  }, [nft]);

  async function fetchPoolPrice() {
    try {
      const params = new URLSearchParams({
        nft,
        action: 'sell',
      });

      const response = await fetch(`/api/trading/price-check?${params}`);
      const data = await response.json();

      if (data.success && data.data.bestPrice.source === 'lssvm') {
        setPoolPrice(data.data.bestPrice.priceEth);
      }
    } catch (error) {
      console.error('Error fetching pool price:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white">How do you want to sell?</h3>

      {/* Option 1: List for Sale */}
      <div className="bg-gray-800 hover:bg-gray-750 rounded-lg p-4 border-2 border-gray-700 hover:border-purple-500 transition-all cursor-pointer">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-bold text-white">List for Sale</div>
              <div className="text-sm text-gray-400">Set your price, wait for a buyer</div>
            </div>
            <div className="text-sm bg-purple-900/30 text-purple-400 px-2 py-1 rounded">
              Your Choice
            </div>
          </div>

          {/* Price Input */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 uppercase tracking-wide">
              Listing Price (ETH)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.001"
                min="0"
                placeholder="0.00"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              />
              <button
                onClick={() => onOptionSelected('list', listPrice)}
                disabled={!listPrice || parseFloat(listPrice) <= 0}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-semibold transition-colors"
              >
                List
              </button>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            • Your NFT stays in your wallet until sold
            <br />• You can cancel anytime
            <br />• No upfront fees
          </div>
        </div>
      </div>

      {/* Option 2: Sell Now (Instant) */}
      {poolPrice ? (
        <button
          onClick={() => onOptionSelected('instant', poolPrice)}
          className="w-full bg-green-900/30 hover:bg-green-900/40 rounded-lg p-4 border-2 border-green-700 hover:border-green-600 transition-all"
        >
          <div className="flex justify-between items-center">
            <div className="text-left">
              <div className="font-bold text-white flex items-center gap-2">
                Sell Now
                <span className="text-xs bg-green-700 px-2 py-0.5 rounded-full">
                  Instant
                </span>
              </div>
              <div className="text-sm text-gray-400">
                Instant sale to liquidity pool
              </div>
              <div className="text-xs text-gray-500 mt-1">
                • Instant settlement
                <br />• No waiting for buyers
                <br />• Small pool fee applies
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-400">{poolPrice} ETH</div>
              <div className="text-xs text-gray-400">Current pool offer</div>
            </div>
          </div>
        </button>
      ) : loading ? (
        <div className="w-full bg-gray-800 rounded-lg p-4 border-2 border-gray-700">
          <div className="animate-pulse flex justify-between items-center">
            <div className="space-y-2">
              <div className="h-4 bg-gray-700 rounded w-24"></div>
              <div className="h-3 bg-gray-700 rounded w-32"></div>
            </div>
            <div className="h-8 bg-gray-700 rounded w-20"></div>
          </div>
          <p className="text-center text-sm text-gray-500 mt-2">
            Checking pool liquidity...
          </p>
        </div>
      ) : (
        <div className="w-full bg-gray-800 rounded-lg p-4 border-2 border-gray-700 opacity-50">
          <div className="text-center space-y-2">
            <div className="font-bold text-gray-500">Sell Now (Unavailable)</div>
            <div className="text-sm text-gray-500">
              No liquidity pool available for instant sale
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
