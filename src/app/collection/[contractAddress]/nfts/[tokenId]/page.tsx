import React from 'react';
import { NFTTransition } from '~/components/NFTTransition';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// Types
interface NFTAttribute {
  trait_type: string;
  value: string;
}

interface NFTMetadata {
  image: string;
  name: string;
  description: string;
  owner: string;
  attributes: NFTAttribute[];
}

interface NFTOwnerInfo {
  owner: string | null;
  tokenType: 'ERC721' | 'ERC1155' | null;
  balance?: number | null;
}

interface Listing {
  isListed: boolean;
  price: string | null;
  expiry: string | null;
  currency: string;
}

interface Offer {
  offerer: string;
  amount: string;
  currency: string;
  expiry: string;
}

// Helper function to get base URL for server-side fetching
function getBaseUrl() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  // For server-side, use environment variable or default
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
}

// Real NFT metadata fetching from existing API
async function fetchNFTMetadata(contractAddress: string, tokenId: string): Promise<NFTMetadata> {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/collection/${contractAddress}/nft/${tokenId}`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch NFT metadata: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract metadata from the new API response structure
    const extractedMetadata = data.metadata || {};
    
    return {
      image: extractedMetadata.image || '/placeholder.png',
      name: extractedMetadata.name || `NFT #${tokenId}`,
      description: extractedMetadata.description || 'No description available',
      owner: extractedMetadata.owners?.[0] || 'Unknown',
      attributes: extractedMetadata.attributes || [],
    };
  } catch (error) {
    console.error('Error fetching NFT metadata:', error);
    // Return fallback data
    return {
      image: '/placeholder.png',
      name: `NFT #${tokenId}`,
      description: 'Failed to load metadata',
      owner: 'Unknown',
      attributes: [],
    };
  }
}

// Enhanced NFT owner fetching with token type and balance information
async function fetchNFTOwnerInfo(contractAddress: string, tokenId: string): Promise<NFTOwnerInfo> {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/collection/${contractAddress}/nfts/${tokenId}/owner`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return { owner: null, tokenType: null }; // NFT might not exist or be transferable
      }
      throw new Error(`Failed to fetch NFT owner: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      owner: data.owner,
      tokenType: data.tokenType,
      balance: data.balance || null,
    };
  } catch (error) {
    console.error('Error fetching NFT owner info:', error);
    return { owner: null, tokenType: null };
  }
}

// TODO: Replace with actual listing fetching logic
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fetchListing(contractAddress: string, tokenId: string): Promise<Listing> {
  // Placeholder: fetch listing from API or DB
  return {
    isListed: false,
    price: null,
    expiry: null,
    currency: 'ETH',
  };
}

// TODO: Replace with actual offers fetching logic
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function fetchOffers(contractAddress: string, tokenId: string): Promise<Offer[]> {
  // Placeholder: fetch offers from API or DB
  return [];
}

// Server component
export default async function NFTPage({ params }: { params: Promise<{ contractAddress: string; tokenId: string }> }) {
  const { contractAddress, tokenId } = await params;

  // Fetch data (replace with SWR or client-side hooks if needed)
  const metadata = await fetchNFTMetadata(contractAddress, tokenId);
  const ownerInfo = await fetchNFTOwnerInfo(contractAddress, tokenId);
  const listing = await fetchListing(contractAddress, tokenId);
  const offers = await fetchOffers(contractAddress, tokenId);

  // TODO: Replace with actual user context (pass as prop or via session)
  const userAddress = '0xViewerAddress';
  const isOwner = ownerInfo.owner && userAddress.toLowerCase() === ownerInfo.owner.toLowerCase();

  return (
    <NFTTransition nftId={tokenId} contractAddress={contractAddress}>
      <main className="max-w-md mx-auto p-4 flex flex-col gap-4 fade-in">
        {/* Back Button */}
        <div className="slide-up">
          <Link
            href={`/collection/${contractAddress}`}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Collection
          </Link>
        </div>

        {/* NFT Image & Metadata */}
        <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center scale-in">
          <img src={metadata.image} alt={metadata.name} className="w-full rounded mb-4" style={{ maxWidth: 320 }} />
          <h1 className="text-xl font-bold mb-2">{metadata.name}</h1>
          <p className="text-gray-600 mb-2">{metadata.description}</p>
          
          {/* Token Type and Ownership Info */}
          <div className="w-full space-y-2 mb-2">
            {/* Token Type */}
            {ownerInfo.tokenType && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Token Type:</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  ownerInfo.tokenType === 'ERC721' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-purple-100 text-purple-800'
                }`}>
                  {ownerInfo.tokenType}
                </span>
              </div>
            )}
            
            {/* Owner Info */}
            {ownerInfo.owner && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Owner:</span>
                <span className="text-gray-700 font-mono">
                  {ownerInfo.owner.slice(0, 6)}...{ownerInfo.owner.slice(-4)}
                </span>
              </div>
            )}
            
            {/* Balance for ERC-1155 */}
            {ownerInfo.tokenType === 'ERC1155' && ownerInfo.balance !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Balance:</span>
                <span className="text-gray-700 font-medium">
                  {ownerInfo.balance} tokens
                </span>
              </div>
            )}
          </div>
          
          {/* Attributes */}
          {metadata.attributes && metadata.attributes.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {metadata.attributes.map((attr, i) => (
                <span key={i} className="bg-gray-100 px-2 py-1 rounded text-xs hover-lift">{attr.trait_type}: {attr.value}</span>
              ))}
            </div>
          )}
        </div>

        {/* Listing/Action Section */}
        <div className="bg-white rounded-lg shadow p-4 flex flex-col gap-2 slide-up">
          {isOwner ? (
            listing.isListed ? (
              <>
                <div className="text-green-600 font-semibold">Listed for {listing.price} {listing.currency}</div>
                <div className="text-xs text-gray-500">Expires: {listing.expiry ? new Date(listing.expiry).toLocaleString() : 'N/A'}</div>
              </>
            ) : (
              <button className="w-full bg-blue-600 text-white py-2 rounded font-bold transition-colors duration-200 hover:bg-blue-700">List for Sale</button>
            )
          ) : (
            <>
              {listing.isListed && (
                <div className="text-green-600 font-semibold">For sale: {listing.price} {listing.currency}</div>
              )}
              <button className="w-full bg-purple-600 text-white py-2 rounded font-bold transition-colors duration-200 hover:bg-purple-700">Make an Offer</button>
            </>
          )}
        </div>

        {/* Offers List */}
        <div className="bg-white rounded-lg shadow p-4 slide-up">
          <h2 className="font-semibold mb-2">Standing Offers</h2>
          {offers.length === 0 ? (
            <div className="text-gray-400 text-sm">No offers yet.</div>
          ) : (
            <ul className="flex flex-col gap-2">
              {offers.map((offer, i) => (
                <li key={i} className="flex justify-between items-center border-b pb-1 last:border-b-0 transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <span className="text-sm">{offer.amount} {offer.currency}</span>
                  <span className="text-xs text-gray-500">by {offer.offerer.slice(0, 6)}...{offer.offerer.slice(-4)}</span>
                  <span className="text-xs text-gray-400">exp: {new Date(offer.expiry).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* TODO: Add modals/forms for listing and making offers, supporting ETH and ERC-20s from DB */}
      </main>
    </NFTTransition>
  );
} 