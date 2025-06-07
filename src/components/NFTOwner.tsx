import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { truncateAddress } from '~/lib/truncateAddress';

interface NFTOwnerProps {
  contractAddress: string;
  tokenId: string;
}

export default function NFTOwner({ contractAddress, tokenId }: NFTOwnerProps) {
  const [owner, setOwner] = useState<string | null>(null);
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
              setOwner(null);
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
          setOwner(data.owner);
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

  if (!owner) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Not transferable
      </div>
    );
  }

  return (
    <div className="text-sm text-gray-600 dark:text-gray-300">
      Owner: {truncateAddress(owner)}
    </div>
  );
} 