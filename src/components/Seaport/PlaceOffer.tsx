'use client';

import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/input';

interface PlaceOfferProps {
  nft: {
    contractAddress: string;
    tokenId: string;
    name?: string;
    image?: string;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PlaceOffer({ nft, onSuccess, onCancel }: PlaceOfferProps) {
  const [offerAmount, setOfferAmount] = useState('');
  const [currency, setCurrency] = useState('ETH');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // TODO: Implement actual Seaport offer creation
      console.log('Creating offer:', {
        contractAddress: nft.contractAddress,
        tokenId: nft.tokenId,
        amount: offerAmount,
        currency
      });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // TODO: Replace with actual API call
      // const response = await fetch('/api/seaport/offers/create', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     contractAddress: nft.contractAddress,
      //     tokenId: nft.tokenId,
      //     amount: offerAmount,
      //     currency
      //   })
      // });

      onSuccess?.();
    } catch (err) {
      setError('Failed to place offer. Please try again.');
      console.error('Error placing offer:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <div className="flex items-center space-x-4 mb-6">
        {nft.image && (
          <img 
            src={nft.image} 
            alt={nft.name || `NFT ${nft.tokenId}`}
            className="w-16 h-16 rounded-lg object-cover"
          />
        )}
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Place Offer
          </h3>
          <p className="text-sm text-gray-600">
            {nft.name || `NFT #${nft.tokenId}`}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Offer Amount
          </label>
          <div className="relative">
            <Input
              type="number"
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              placeholder="0.1"
              step="0.01"
              min="0"
              required
              className="pr-20"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="text-sm text-gray-600 bg-transparent border-none focus:ring-0"
              >
                <option value="ETH">ETH</option>
                <option value="USDC">USDC</option>
                <option value="WETH">WETH</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        <div className="bg-gray-50 p-4 rounded-md">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Platform Fee</span>
            <span className="text-gray-900">2.5%</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600">Network Fee</span>
            <span className="text-gray-900">~$0.01</span>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <Button
            type="submit"
            disabled={loading || !offerAmount}
            className="flex-1"
          >
            {loading ? 'Placing Offer...' : 'Place Offer'}
          </Button>
        </div>
      </form>

      <div className="mt-4 text-xs text-gray-500">
        <p>• Your offer will be valid for 7 days</p>
        <p>• You can cancel your offer at any time</p>
        <p>• The seller will be notified of your offer</p>
      </div>
    </div>
  );
} 