'use client'

import { useQuery } from '@tanstack/react-query'
import { Address } from 'viem'
import { getPublicClient } from '@/lib/wagmi'
import { ERC1155_ABI } from '@/lib/contracts'
import { fetchERC1155Metadata, NFTMetadata } from '@/lib/metadata'

export interface ERC1155PoolMetadata {
  metadata: NFTMetadata | null
  balance: bigint
}

/**
 * Fetch ERC1155 pool metadata and balance
 */
export function useERC1155PoolMetadata(
  poolAddress: Address | undefined,
  nftAddress: Address | undefined,
  nftId: bigint | undefined,
  chainId: number
) {
  return useQuery({
    queryKey: ['erc1155PoolMetadata', poolAddress, nftAddress, nftId?.toString(), chainId],
    queryFn: async (): Promise<ERC1155PoolMetadata> => {
      if (!poolAddress || !nftAddress || nftId === undefined) {
        return { metadata: null, balance: 0n }
      }

      try {
        const client = getPublicClient(chainId)
        
        // Get pool's balance for this NFT ID
        const balance = await client.readContract({
          address: nftAddress,
          abi: ERC1155_ABI,
          functionName: 'balanceOf',
          args: [poolAddress, nftId],
        })

        // Fetch metadata
        const metadata = await fetchERC1155Metadata(nftAddress, nftId, chainId)

        return {
          metadata,
          balance: balance as bigint,
        }
      } catch (error) {
        console.error('Error fetching ERC1155 pool metadata:', error)
        return { metadata: null, balance: 0n }
      }
    },
    enabled: !!poolAddress && !!nftAddress && nftId !== undefined,
    staleTime: 60000, // 1 minute
  })
}

