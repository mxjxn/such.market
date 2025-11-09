'use client';

import { useState } from 'react';
import { useAccount, useChainId, useSignTypedData } from 'wagmi';
import { base } from 'wagmi/chains';
import { SEAPORT_CONFIG, SEAPORT_DOMAIN } from '~/lib/seaport/config';
import type { CreateOfferRequest, CreateOfferResponse } from '~/lib/seaport/types';
import type { OrderComponents } from '@opensea/seaport-js/lib/types';

interface OfferFormProps {
  contractAddress: string;
  tokenId: string;
  ownerAddress: string | null;
}

/**
 * EIP-712 types for Seaport order signing
 */
const ORDER_TYPES = {
  OrderComponents: [
    { name: 'offerer', type: 'address' },
    { name: 'zone', type: 'address' },
    { name: 'offer', type: 'OfferItem[]' },
    { name: 'consideration', type: 'ConsiderationItem[]' },
    { name: 'orderType', type: 'uint8' },
    { name: 'startTime', type: 'uint256' },
    { name: 'endTime', type: 'uint256' },
    { name: 'zoneHash', type: 'bytes32' },
    { name: 'salt', type: 'uint256' },
    { name: 'conduitKey', type: 'bytes32' },
    { name: 'counter', type: 'uint256' },
    { name: 'totalOriginalConsiderationItems', type: 'uint256' },
  ],
  OfferItem: [
    { name: 'itemType', type: 'uint8' },
    { name: 'token', type: 'address' },
    { name: 'identifierOrCriteria', type: 'uint256' },
    { name: 'startAmount', type: 'uint256' },
    { name: 'endAmount', type: 'uint256' },
  ],
  ConsiderationItem: [
    { name: 'itemType', type: 'uint8' },
    { name: 'token', type: 'address' },
    { name: 'identifierOrCriteria', type: 'uint256' },
    { name: 'startAmount', type: 'uint256' },
    { name: 'endAmount', type: 'uint256' },
    { name: 'recipient', type: 'address' },
  ],
};

export function OfferForm({ contractAddress, tokenId, ownerAddress }: OfferFormProps) {
  const [offerAmount, setOfferAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [orderHash, setOrderHash] = useState<string | null>(null);
  
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData();

  // Check if user is on Base mainnet
  const isBaseMainnet = chainId === base.id;

  // Check if user owns the NFT
  const isOwner = ownerAddress && address && ownerAddress.toLowerCase() === address.toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setOrderHash(null);

    if (!isConnected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!address) {
      setError('Wallet address not found');
      return;
    }

    if (!isBaseMainnet) {
      setError('Please switch to Base mainnet');
      return;
    }

    if (isOwner) {
      setError('You cannot make an offer on your own NFT');
      return;
    }

    const amount = parseFloat(offerAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid offer amount');
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Create the order via API
      const createRequest: CreateOfferRequest = {
        contractAddress,
        tokenId,
        offerAmountEth: offerAmount,
        offererAddress: address,
      };

      const createResponse = await fetch('/api/seaport/offers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createRequest),
      });

      const createData: CreateOfferResponse = await createResponse.json();

      if (!createData.success || !createData.orderComponents) {
        throw new Error(createData.error || 'Failed to create offer order');
      }

      const orderComponents = createData.orderComponents;

      // Step 2: Sign the order using EIP-712
      // Note: The Seaport SDK uses a specific domain structure
      // We need to construct the message according to Seaport's EIP-712 spec
      const domain = {
        name: SEAPORT_DOMAIN.name,
        version: SEAPORT_DOMAIN.version,
        chainId: BigInt(SEAPORT_DOMAIN.chainId),
        verifyingContract: SEAPORT_DOMAIN.verifyingContract as `0x${string}`,
      };

      // Convert order components to the format expected by wagmi
      const message = {
        offerer: orderComponents.offerer as `0x${string}`,
        zone: orderComponents.zone as `0x${string}`,
        offer: orderComponents.offer.map(item => ({
          itemType: item.itemType,
          token: item.token as `0x${string}`,
          identifierOrCriteria: BigInt(item.identifierOrCriteria),
          startAmount: BigInt(item.startAmount),
          endAmount: BigInt(item.endAmount),
        })),
        consideration: orderComponents.consideration.map(item => ({
          itemType: item.itemType,
          token: item.token as `0x${string}`,
          identifierOrCriteria: BigInt(item.identifierOrCriteria),
          startAmount: BigInt(item.startAmount),
          endAmount: BigInt(item.endAmount),
          recipient: item.recipient as `0x${string}`,
        })),
        orderType: orderComponents.orderType,
        startTime: BigInt(orderComponents.startTime),
        endTime: BigInt(orderComponents.endTime),
        zoneHash: orderComponents.zoneHash as `0x${string}`,
        salt: BigInt(orderComponents.salt),
        conduitKey: orderComponents.conduitKey as `0x${string}`,
        counter: BigInt(orderComponents.counter),
        totalOriginalConsiderationItems: BigInt(orderComponents.totalOriginalConsiderationItems || orderComponents.consideration.length.toString()),
      };

      // Sign the typed data
      const signature = await signTypedDataAsync({
        domain,
        types: ORDER_TYPES as any,
        primaryType: 'OrderComponents',
        message: message as any,
      });

      // Log the signed order for now (in production, you'd store this)
      console.log('Signed order:', {
        orderHash: createData.orderHash,
        orderComponents,
        signature,
      });

      setSuccess('Offer created and signed successfully!');
      setOrderHash(createData.orderHash);
      setOfferAmount(''); // Reset form
    } catch (err) {
      console.error('Error creating offer:', err);
      setError(err instanceof Error ? err.message : 'Failed to create offer');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800 text-sm">Please connect your wallet to make an offer</p>
      </div>
    );
  }

  if (!isBaseMainnet) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800 text-sm">Please switch to Base mainnet to make an offer</p>
      </div>
    );
  }

  if (isOwner) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-800 text-sm">You own this NFT. You can list it for sale instead.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="offerAmount" className="block text-sm font-medium text-gray-700 mb-1">
          Offer Amount (ETH)
        </label>
        <input
          id="offerAmount"
          type="number"
          step="0.001"
          min="0.001"
          value={offerAmount}
          onChange={(e) => setOfferAmount(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          placeholder="0.001"
          required
          disabled={isSubmitting}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-green-800 text-sm font-semibold">{success}</p>
          {orderHash && (
            <p className="text-green-700 text-xs mt-1 font-mono">Order Hash: {orderHash.slice(0, 10)}...{orderHash.slice(-8)}</p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !offerAmount}
        className="w-full bg-purple-600 text-white py-2 px-4 rounded-md font-semibold transition-colors duration-200 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Creating Offer...' : 'Make Offer'}
      </button>
    </form>
  );
}

