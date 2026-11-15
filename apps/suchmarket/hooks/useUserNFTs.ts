import { useQuery } from '@tanstack/react-query'
import { Address } from 'viem'
import { useAccount } from 'wagmi'
import { getPublicClient } from '@/lib/wagmi'
import { ERC721_ABI, ERC1155_ABI } from '@/lib/contracts'

export interface UserNFT {
  tokenId: bigint
  balance: bigint
}

/**
 * Fetch user's ERC721 NFTs for a given collection
 */
export function useUserERC721NFTs(nftAddress: Address | undefined, chainId: number) {
  const { address } = useAccount()

  return useQuery({
    queryKey: ['userERC721NFTs', nftAddress, address, chainId],
    queryFn: async (): Promise<UserNFT[]> => {
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

        // Fetch all token IDs (this is a simplified version - in production you might need to use an indexer)
        const tokenIds: bigint[] = []
        // Note: This assumes the contract supports tokenOfOwnerByIndex
        // For production, consider using an indexer or subgraph
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
            // Some contracts don't support tokenOfOwnerByIndex
            console.warn(`Could not fetch token at index ${i}:`, error)
          }
        }

        return tokenIds.map((tokenId) => ({
          tokenId,
          balance: 1n,
        }))
      } catch (error) {
        console.error('Error fetching user ERC721 NFTs:', error)
        return []
      }
    },
    enabled: !!nftAddress && !!address,
    staleTime: 60000, // 1 minute
  })
}

/**
 * Fetch user's ERC1155 NFT balance for a given collection and token ID
 */
export function useUserERC1155Balance(
  nftAddress: Address | undefined,
  tokenId: bigint | undefined,
  chainId: number
) {
  const { address } = useAccount()

  return useQuery({
    queryKey: ['userERC1155Balance', nftAddress, tokenId?.toString(), address, chainId],
    queryFn: async (): Promise<bigint> => {
      if (!nftAddress || !address || tokenId === undefined) return 0n

      try {
        const client = getPublicClient(chainId)
        const balance = await client.readContract({
          address: nftAddress,
          abi: ERC1155_ABI,
          functionName: 'balanceOf',
          args: [address, tokenId],
        })

        return balance as bigint
      } catch (error) {
        console.error('Error fetching user ERC1155 balance:', error)
        return 0n
      }
    },
    enabled: !!nftAddress && !!address && tokenId !== undefined,
    staleTime: 30000, // 30 seconds
  })
}

