'use client'

import { useQuery } from '@tanstack/react-query'
import { Address } from 'viem'
import { getPublicClient } from '@/lib/wagmi'
import { ERC721_ABI, LSSVM_PAIR_ABI } from '@/lib/contracts'
import { fetchERC721Metadata, NFTMetadata } from '@/lib/metadata'

export interface PoolNFT {
  tokenId: bigint
  metadata: NFTMetadata | null
}

/**
 * Fetch all ERC721 NFTs owned by a pool
 */
export function usePoolNFTs(
  poolAddress: Address | undefined,
  nftAddress: Address | undefined,
  chainId: number
) {
  return useQuery({
    queryKey: ['poolNFTs', poolAddress, nftAddress, chainId],
    queryFn: async (): Promise<PoolNFT[]> => {
      if (!poolAddress || !nftAddress) return []

      try {
        const client = getPublicClient(chainId)
        
        // Get pool's NFT balance to verify
        const balance = await client.readContract({
          address: nftAddress,
          abi: ERC721_ABI,
          functionName: 'balanceOf',
          args: [poolAddress],
        })

        if (balance === 0n) return []

        // Get all token IDs owned by the pool from the pool contract
        // getAllIds() on the pool contract returns the token IDs currently in the pool
        let poolTokenIds: bigint[] = []
        
        try {
          poolTokenIds = await client.readContract({
            address: poolAddress,
            abi: LSSVM_PAIR_ABI,
            functionName: 'getAllIds',
          }) as bigint[]
        } catch (getAllIdsError) {
          // getAllIds() doesn't exist or reverted - this pool doesn't support enumeration
          console.warn('getAllIds() not available on pool, cannot enumerate NFTs:', getAllIdsError)
          // Return empty array - we can't enumerate without getAllIds
          return []
        }

        if (poolTokenIds.length === 0) {
          return []
        }

        // Fetch metadata for each token ID owned by the pool
        const nfts: PoolNFT[] = await Promise.all(
          poolTokenIds.map(async (tokenId) => {
            const metadata = await fetchERC721Metadata(nftAddress, tokenId, chainId)
            return {
              tokenId,
              metadata,
            }
          })
        )

        return nfts
      } catch (error) {
        console.error('Error fetching pool NFTs:', error)
        return []
      }
    },
    enabled: !!poolAddress && !!nftAddress,
    staleTime: 60000, // 1 minute
  })
}

