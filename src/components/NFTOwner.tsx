import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { truncateAddress } from '~/lib/truncateAddress';

interface NFTOwnerProps {
  contractAddress: string;
  tokenId: string;
}

interface OwnerInfo {
  owner: string | null;
  tokenType: 'ERC721' | 'ERC1155' | null;
  balance?: number | null;
}

export default function NFTOwner({ contractAddress, tokenId }: NFTOwnerProps) {
  const [ownerInfo, setOwnerInfo] = useState<OwnerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 2;

    async function fetchOwner() {
      try {
        const response = await fetch(`/api/collection/${contractAddress}/nfts/${tokenId}/owner`);
        if (!response.ok) {
          // Don't retry on 404s - this means the NFT might not exist or be transferable
          if (response.status === 404) {
            if (isMounted) {
              setOwnerInfo({ owner: null, tokenType: null });
              setError(null);
            }
            return;
          }
          // For other errors, retry up to maxRetries times
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(fetchOwner, 1000 * retryCount); // Exponential backoff
            return;
          }
          throw new Error('Failed to fetch owner');
        }
        const data = await response.json();
        if (isMounted) {
          setOwnerInfo({
            owner: data.owner,
            tokenType: data.tokenType,
            balance: data.balance,
          });
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching NFT owner:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch owner');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchOwner();

    return () => {
      isMounted = false;
    };
  }, [contractAddress, tokenId]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Loading owner...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500 dark:text-red-400">
        Failed to load owner
      </div>
    );
  }

  if (!ownerInfo?.owner) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Not transferable
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Token Type */}
      {ownerInfo.tokenType && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500">Type:</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            ownerInfo.tokenType === 'ERC721' 
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
              : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
          }`}>
            {ownerInfo.tokenType}
          </span>
        </div>
      )}
      
      {/* Owner Address */}
      <div className="text-sm text-gray-600 dark:text-gray-300">
        Owner: {truncateAddress(ownerInfo.owner)}
      </div>
      
      {/* Balance for ERC-1155 */}
      {ownerInfo.tokenType === 'ERC1155' && ownerInfo.balance !== null && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Balance: {ownerInfo.balance} tokens
        </div>
      )}
    </div>
  );
} 