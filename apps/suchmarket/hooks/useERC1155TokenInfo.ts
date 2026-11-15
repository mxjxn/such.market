import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Address, isAddress } from 'viem'
import { useAccount } from 'wagmi'
import { getPublicClient } from '@/lib/wagmi'
import { ERC1155_ABI } from '@/lib/contracts'
import { fetchERC1155Metadata, NFTMetadata } from '@/lib/metadata'

export interface ERC1155TokenInfo {
  tokenId: bigint
  balance: bigint
  metadata: NFTMetadata | null
}

/**
 * Hook to fetch ERC1155 token info (balance and metadata) with debouncing
 * Waits 3 seconds after user stops typing before fetching
 */
export function useERC1155TokenInfo(
  nftAddress: Address | undefined,
  tokenIdString: string | undefined,
  chainId: number
) {
  const { address: userAddress } = useAccount()
  const [debouncedTokenId, setDebouncedTokenId] = useState<string | undefined>(undefined)

  // Debounce the token ID input - wait 3 seconds after user stops typing
  useEffect(() => {
    if (!tokenIdString || tokenIdString.trim() === '') {
      setDebouncedTokenId(undefined)
      return
    }

    // Validate it's a valid number
    const tokenIdNum = BigInt(tokenIdString.trim())
    if (tokenIdNum < 0n) {
      setDebouncedTokenId(undefined)
      return
    }

    const timer = setTimeout(() => {
      setDebouncedTokenId(tokenIdString.trim())
    }, 3000) // 3 second delay

    return () => clearTimeout(timer)
  }, [tokenIdString])

  // Fetch token info when debounced value is ready
  const { data, isLoading, error } = useQuery<ERC1155TokenInfo | null, Error>({
    queryKey: ['erc1155TokenInfo', nftAddress, debouncedTokenId, userAddress, chainId],
    queryFn: async () => {
      if (!nftAddress || !isAddress(nftAddress) || !debouncedTokenId || !userAddress) {
        return null
      }

      try {
        const client = getPublicClient(chainId)
        const tokenId = BigInt(debouncedTokenId)

        // Fetch balance first (required)
        let balance: bigint
        try {
          balance = await client.readContract({
            address: nftAddress,
            abi: ERC1155_ABI,
            functionName: 'balanceOf',
            args: [userAddress, tokenId],
          }) as bigint
        } catch (balanceError) {
          console.error('Error fetching ERC1155 balance:', balanceError)
          // If balance fetch fails, token might not exist or user doesn't own it
          return null
        }

        // Fetch metadata separately (optional - don't fail if this errors)
        let metadata: NFTMetadata | null = null
        try {
          metadata = await fetchERC1155Metadata(nftAddress, tokenId, chainId)
        } catch (metadataError) {
          // Metadata fetch failed, but that's okay - we can still show balance
          console.warn('Could not fetch ERC1155 metadata (this is okay):', metadataError)
          metadata = null
        }

        return {
          tokenId,
          balance,
          metadata,
        }
      } catch (error) {
        console.error('Error fetching ERC1155 token info:', error)
        // Return null on unexpected error
        return null
      }
    },
    enabled: !!nftAddress && !!isAddress(nftAddress) && !!debouncedTokenId && !!userAddress && chainId > 0,
    staleTime: 30 * 1000, // 30 seconds
  })

  return {
    tokenInfo: data,
    isLoading: isLoading || (tokenIdString !== undefined && tokenIdString !== debouncedTokenId),
    error,
    isDebouncing: tokenIdString !== undefined && tokenIdString !== debouncedTokenId,
  }
}

