'use client'

import { useQuery } from '@tanstack/react-query'
import { Address } from 'viem'
import { useAccount } from 'wagmi'
import { getPublicClient } from '@/lib/wagmi'
import { ERC721_ABI } from '@/lib/contracts'
import { fetchERC721Metadata, NFTMetadata } from '@/lib/metadata'

export interface UserNFTWithMetadata {
  tokenId: bigint
  metadata: NFTMetadata | null
}

/**
 * Fetch user's ERC721 NFTs with metadata for a given collection
 */
export function useUserNFTsWithMetadata(nftAddress: Address | undefined, chainId: number) {
  const { address } = useAccount()

  return useQuery({
    queryKey: ['userNFTsWithMetadata', nftAddress, address, chainId],
    queryFn: async (): Promise<UserNFTWithMetadata[]> => {
      if (!nftAddress || !address) return []

      try {
        const client = getPublicClient(chainId)
        // Get balance
        const balance = await client.readContract({
          address: nftAddress,
          abi: ERC721_ABI,
          functionName: 'balanceOf',
          args: [address],
        })

        if (balance === 0n) return []

        // Fetch all token IDs
        const tokenIds: bigint[] = []
        for (let i = 0; i < Number(balance); i++) {
          try {
            const tokenId = await client.readContract({
              address: nftAddress,
              abi: ERC721_ABI,
              functionName: 'tokenOfOwnerByIndex',
              args: [address, BigInt(i)],
            })
            tokenIds.push(tokenId as bigint)
          } catch (error) {
            console.warn(`Could not fetch token at index ${i}:`, error)
          }
        }

        // Fetch metadata for each token ID
        const nfts: UserNFTWithMetadata[] = await Promise.all(
          tokenIds.map(async (tokenId) => {
            const metadata = await fetchERC721Metadata(nftAddress, tokenId, chainId)
            return {
              tokenId,
              metadata,
            }
          })
        )

        return nfts
      } catch (error) {
        console.error('Error fetching user NFTs with metadata:', error)
        return []
      }
    },
    enabled: !!nftAddress && !!address,
    staleTime: 60000, // 1 minute
  })
}

