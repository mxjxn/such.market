'use client'

import { useQuery } from '@tanstack/react-query'
import { Address } from 'viem'
import { getPublicClient } from '@/lib/wagmi'
import { LSSVM_PAIR_ABI, ERC1155_ABI } from '@/lib/contracts'
import { queryPoolsByNFTContract, Pool } from '@/lib/subgraph'

export interface AggregatedNFT {
  tokenId: bigint
  poolAddress: Address
  poolType: number
  poolVariant: number
  price: bigint // Price to buy this NFT (in wei)
  spotPrice: bigint
  delta: bigint
  fee: bigint
  bondingCurve: Address
  tokenContract: Address | null // ERC20 token address (null for ETH pools)
  nftId: bigint | null // For ERC1155 pools
  amount: bigint | null // For ERC1155 pools (available quantity)
}

/**
 * Aggregates NFTs from all pools for a given NFT contract, ordered by price
 * For ERC721: fetches all token IDs from each pool
 * For ERC1155: uses the nftId and currentNFTBalance from subgraph
 */
export function useAggregatedNFTs(
  nftContract: Address | undefined,
  chainId: number
) {
  return useQuery({
    queryKey: ['aggregatedNFTs', nftContract, chainId],
    queryFn: async (): Promise<AggregatedNFT[]> => {
      if (!nftContract) return []

      try {
        // Query subgraph for all pools
        const pools = await queryPoolsByNFTContract(chainId, nftContract)
        
        if (pools.length === 0) {
          return []
        }

        const client = getPublicClient(chainId)
        const aggregatedNFTs: AggregatedNFT[] = []

        // Process each pool
        for (const pool of pools) {
          const poolAddress = pool.id as Address
          const isERC1155 = pool.poolVariant === 2 || pool.poolVariant === 3 // ERC1155_ETH or ERC1155_ERC20

          try {
            if (isERC1155) {
              // ERC1155 pool - use nftId and currentNFTBalance from subgraph
              const nftId = pool.nftId ? BigInt(pool.nftId) : null
              const balance = pool.currentNFTBalance ? BigInt(pool.currentNFTBalance) : 0n

              if (nftId !== null && balance > 0n) {
                // For ERC1155, assetId is 0 (the pool only holds one NFT type)
                // Calculate price for buying 1 NFT
                try {
                  const quoteResult = await client.readContract({
                    address: poolAddress,
                    abi: LSSVM_PAIR_ABI,
                    functionName: 'getBuyNFTQuote',
                    args: [0n, 1n], // assetId = 0, numItems = 1
                  })

                  const inputAmount = quoteResult[3] as bigint // inputAmount is the price

                  aggregatedNFTs.push({
                    tokenId: nftId,
                    poolAddress,
                    poolType: pool.poolType,
                    poolVariant: pool.poolVariant,
                    price: inputAmount,
                    spotPrice: BigInt(pool.spotPrice),
                    delta: BigInt(pool.delta),
                    fee: BigInt(pool.fee),
                    bondingCurve: pool.bondingCurve as Address,
                    tokenContract: pool.tokenContract ? (pool.tokenContract as Address) : null,
                    nftId,
                    amount: balance,
                  })
                } catch (quoteError) {
                  console.warn(`Error getting buy quote for ERC1155 pool ${poolAddress}:`, quoteError)
                  // Skip this pool if quote fails
                }
              }
            } else {
              // ERC721 pool - fetch all token IDs
              try {
                const tokenIds = await client.readContract({
                  address: poolAddress,
                  abi: LSSVM_PAIR_ABI,
                  functionName: 'getAllIds',
                }) as bigint[]

                if (tokenIds.length === 0) {
                  continue
                }

                // Calculate price for each NFT
                for (const tokenId of tokenIds) {
                  try {
                    // For ERC721, assetId is the tokenId
                    const quoteResult = await client.readContract({
                      address: poolAddress,
                      abi: LSSVM_PAIR_ABI,
                      functionName: 'getBuyNFTQuote',
                      args: [tokenId, 1n], // assetId = tokenId, numItems = 1
                    })

                    const inputAmount = quoteResult[3] as bigint // inputAmount is the price

                    aggregatedNFTs.push({
                      tokenId,
                      poolAddress,
                      poolType: pool.poolType,
                      poolVariant: pool.poolVariant,
                      price: inputAmount,
                      spotPrice: BigInt(pool.spotPrice),
                      delta: BigInt(pool.delta),
                      fee: BigInt(pool.fee),
                      bondingCurve: pool.bondingCurve as Address,
                      tokenContract: pool.tokenContract ? (pool.tokenContract as Address) : null,
                      nftId: null,
                      amount: null,
                    })
                  } catch (quoteError) {
                    console.warn(`Error getting buy quote for NFT ${tokenId} in pool ${poolAddress}:`, quoteError)
                    // Skip this NFT if quote fails
                  }
                }
              } catch (getAllIdsError) {
                console.warn(`Error fetching NFT IDs from pool ${poolAddress}:`, getAllIdsError)
                // Skip this pool if getAllIds fails
              }
            }
          } catch (poolError) {
            console.warn(`Error processing pool ${poolAddress}:`, poolError)
            // Continue with next pool
          }
        }

        // Sort by price ascending (cheapest first)
        aggregatedNFTs.sort((a, b) => {
          if (a.price < b.price) return -1
          if (a.price > b.price) return 1
          return 0
        })

        return aggregatedNFTs
      } catch (error) {
        console.error('Error aggregating NFTs:', error)
        return []
      }
    },
    enabled: !!nftContract,
    staleTime: 30000, // 30 seconds
  })
}

