"use client";

/**
 * Unified Trading View Component
 * Smart routing UI that shows best price from LSSVM pools and Seaport listings
 * Implements Option B: Smart Routing approach
 */

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import type { BestPriceResult } from '~/lib/lssvm/types';

interface UnifiedTradingViewProps {
  nft: string;
  tokenId?: string;
  action: 'buy' | 'sell';
  onSuccess?: (txHash: string) => void;
  onError?: (error: string) => void;
}

export function UnifiedTradingView({
  nft,
  tokenId,
  action,
  onSuccess,
  onError,
}: UnifiedTradingViewProps) {
  const { address, isConnected } = useAccount();
  const [priceData, setPriceData] = useState<BestPriceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPriceData();
  }, [nft, tokenId, action]);

  async function fetchPriceData() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        nft,
        action,
        ...(tokenId && { tokenId }),
      });

      const response = await fetch(`/api/trading/price-check?${params}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch price');
      }

      setPriceData(data.data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  async function executeTrade() {
    if (!isConnected) {
      setError('Please connect your wallet');
      return;
    }

    if (!priceData?.bestPrice) {
      setError('No price data available');
      return;
    }

    try {
      setExecuting(true);
      setError(null);

      if (action === 'buy') {
        const response = await fetch('/api/trading/buy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nft,
            tokenId,
            maxPrice: priceData.bestPrice.price,
            route: priceData.bestPrice.route,
          }),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Trade failed');
        }

        onSuccess?.(result.data.txHash || result.data.orderHash);
      } else {
        // Sell/List flow
        const response = await fetch('/api/trading/sell', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nft,
            tokenId,
            minPrice: priceData.bestPrice.price,
            route: priceData.bestPrice.route,
          }),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'Trade failed');
        }

        onSuccess?.(result.data.txHash || result.data.listingHash);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setExecuting(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-700 rounded w-1/2 mx-auto"></div>
          <div className="h-12 bg-gray-700 rounded"></div>
          <div className="h-10 bg-gray-700 rounded"></div>
        </div>
        <p className="text-center text-sm text-gray-400 mt-4">
          Finding best price...
        </p>
      </div>
    );
  }

  // Error state
  if (error && !priceData) {
    return (
      <div className="bg-gradient-to-br from-red-900/20 to-gray-900 rounded-lg p-6 border border-red-800">
        <div className="text-center space-y-4">
          <div className="text-red-400 font-semibold">Unable to fetch price</div>
          <p className="text-sm text-gray-400">{error}</p>
          <button
            onClick={fetchPriceData}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white py-2 px-4 rounded transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // No liquidity state
  if (!priceData?.bestPrice || priceData.bestPrice.price === '0') {
    return (
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6">
        <div className="text-center space-y-4">
          <div className="text-yellow-400 font-semibold">No liquidity available</div>
          <p className="text-sm text-gray-400">
            {action === 'buy'
              ? 'No listings or pools available for this NFT'
              : 'No offers or pools available for this NFT'}
          </p>
          {action === 'sell' && (
            <button
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors"
            >
              Create Listing
            </button>
          )}
        </div>
      </div>
    );
  }

  const { bestPrice, alternatives } = priceData;

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 space-y-4">
      {/* Best Price Display */}
      <div className="text-center">
        <div className="text-sm text-gray-400 uppercase tracking-wide">
          {action === 'buy' ? 'Best Buy Price' : 'Best Sell Price'}
        </div>
        <div className="text-4xl font-bold text-white mt-2">
          {bestPrice.priceEth} ETH
        </div>

        {/* Instant badge */}
        {bestPrice.instant && (
          <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-green-900/30 text-green-400 rounded-full text-sm">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Instant {action === 'buy' ? 'Buy' : 'Sell'}
          </div>
        )}

        {/* Route info */}
        <div className="text-xs text-gray-500 mt-2">
          via {bestPrice.source === 'lssvm' ? 'Liquidity Pool' : 'Marketplace Listing'}
        </div>
      </div>

      {/* Execute Button */}
      <button
        onClick={executeTrade}
        disabled={executing || !isConnected}
        className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100"
      >
        {executing ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Processing...
          </span>
        ) : !isConnected ? (
          'Connect Wallet'
        ) : (
          `${action === 'buy' ? 'Buy Now' : 'Sell Now'} · ${bestPrice.priceEth} ETH`
        )}
      </button>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Alternative Options */}
      {alternatives && alternatives.length > 0 && (
        <div className="border-t border-gray-700 pt-4 mt-4">
          <div className="text-sm text-gray-400 mb-2">Other Options:</div>
          <div className="space-y-2">
            {alternatives.map((alt, i) => (
              <div
                key={i}
                className="flex justify-between items-center text-sm bg-gray-800/50 rounded p-3"
              >
                <div>
                  <div className="text-white font-medium">{alt.priceEth} ETH</div>
                  <div className="text-gray-500 text-xs">
                    {alt.instant ? 'Instant' : 'Requires signature'} ·{' '}
                    {alt.source === 'lssvm' ? 'Pool' : 'Listing'}
                  </div>
                </div>
                <button
                  onClick={() => {
                    // TODO: Allow selecting alternative route
                  }}
                  className="text-blue-400 hover:text-blue-300 text-xs"
                >
                  Select
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pool Info (if applicable) */}
      {bestPrice.metadata?.poolType && (
        <div className="text-xs text-gray-500 text-center border-t border-gray-700 pt-3 mt-3">
          <div>Pool Type: {bestPrice.metadata.poolType}</div>
          {bestPrice.metadata.spotPrice && (
            <div className="mt-1">
              Spot Price: {(Number(bestPrice.metadata.spotPrice) / 1e18).toFixed(6)} ETH
            </div>
          )}
        </div>
      )}

      {/* Expiration (if applicable) */}
      {bestPrice.expiration && (
        <div className="text-xs text-gray-500 text-center">
          Expires: {new Date(bestPrice.expiration * 1000).toLocaleString()}
        </div>
      )}
    </div>
  );
}
