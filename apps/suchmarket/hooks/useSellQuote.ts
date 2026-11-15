import { useQuery } from '@tanstack/react-query'
import { Address } from 'viem'
import { getPublicClient } from '@/lib/wagmi'
import { LSSVM_PAIR_ABI, SellNFTQuote, CurveError } from '@/lib/contracts'

export function useSellQuote(
  pairAddress: Address | undefined,
  assetId: bigint | undefined,
  numNFTs: number,
  chainId: number
) {
  return useQuery({
    queryKey: ['sellQuote', pairAddress, assetId?.toString(), numNFTs, chainId],
    queryFn: async (): Promise<SellNFTQuote | null> => {
      if (!pairAddress || assetId === undefined) return null

      try {
        const client = getPublicClient(chainId)
        const result = await client.readContract({
          address: pairAddress,
          abi: LSSVM_PAIR_ABI,
          functionName: 'getSellNFTQuote',
          args: [assetId, BigInt(numNFTs)],
        })

        return {
          error: result[0] as CurveError,
          newSpotPrice: result[1] as bigint,
          newDelta: result[2] as bigint,
          outputAmount: result[3] as bigint,
          protocolFee: result[4] as bigint,
          royaltyAmount: result[5] as bigint,
        }
      } catch (error) {
        console.error('Error fetching sell quote:', error)
        return null
      }
    },
    enabled: !!pairAddress && assetId !== undefined && numNFTs > 0,
    staleTime: 10000, // 10 seconds
  })
}

