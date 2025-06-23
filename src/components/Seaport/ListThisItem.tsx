'use client';

import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/input';

interface ListThisItemProps {
  nft: {
    contractAddress: string;
    tokenId: string;
    name?: string;
    image?: string;
    owner?: string;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ListThisItem({ nft, onSuccess, onCancel }: ListThisItemProps) {
  const [listingPrice, setListingPrice] = useState('');
  const [currency, setCurrency] = useState('ETH');
  const [listingDuration, setListingDuration] = useState('7'); // days
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // TODO: Implement actual Seaport listing creation
      console.log('Creating listing:', {
        contractAddress: nft.contractAddress,
        tokenId: nft.tokenId,
        price: listingPrice,
        currency,
        duration: listingDuration
      });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // TODO: Replace with actual API call
      // const response = await fetch('/api/seaport/listings/create', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     contractAddress: nft.contractAddress,
      //     tokenId: nft.tokenId,
      //     price: listingPrice,
      //     currency,
      //     duration: parseInt(listingDuration)
      //   })
      // });

      onSuccess?.();
    } catch (err) {
      setError('Failed to create listing. Please try again.');
      console.error('Error creating listing:', err);
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
            List This Item
          </h3>
          <p className="text-sm text-gray-600">
            {nft.name || `NFT #${nft.tokenId}`}
          </p>
          {nft.owner && (
            <p className="text-xs text-gray-500">
              Owned by {nft.owner.slice(0, 6)}...{nft.owner.slice(-4)}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Listing Price
          </label>
          <div className="relative">
            <Input
              type="number"
              value={listingPrice}
              onChange={(e) => setListingPrice(e.target.value)}
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Listing Duration
          </label>
          <select
            value={listingDuration}
            onChange={(e) => setListingDuration(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1">1 day</option>
            <option value="3">3 days</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </select>
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
            <span className="text-gray-600">Creator Royalty</span>
            <span className="text-gray-900">5%</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600">You&apos;ll Receive</span>
            <span className="text-gray-900 font-medium">
              {listingPrice ? `${(parseFloat(listingPrice) * 0.925).toFixed(4)} ${currency}` : '0'}
            </span>
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
            disabled={loading || !listingPrice}
            className="flex-1"
          >
            {loading ? 'Creating Listing...' : 'List Item'}
          </Button>
        </div>
      </form>

      <div className="mt-4 text-xs text-gray-500">
        <p>• You&apos;ll need to approve the marketplace to transfer your NFT</p>
        <p>• You can cancel your listing at any time</p>
        <p>• Your NFT will be locked in the marketplace contract</p>
      </div>
    </div>
  );
} 