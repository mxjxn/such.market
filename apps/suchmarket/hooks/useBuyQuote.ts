import { useQuery } from '@tanstack/react-query'
import { Address } from 'viem'
import { getPublicClient } from '@/lib/wagmi'
import { LSSVM_PAIR_ABI, BuyNFTQuote, CurveError } from '@/lib/contracts'

export function useBuyQuote(
  pairAddress: Address | undefined,
  assetId: bigint | undefined,
  numItems: number,
  chainId: number
) {
  return useQuery({
    queryKey: ['buyQuote', pairAddress, assetId?.toString(), numItems, chainId],
    queryFn: async (): Promise<BuyNFTQuote | null> => {
      if (!pairAddress || assetId === undefined) return null

      try {
        const client = getPublicClient(chainId)
        const result = await client.readContract({
          address: pairAddress,
          abi: LSSVM_PAIR_ABI,
          functionName: 'getBuyNFTQuote',
          args: [assetId, BigInt(numItems)],
        })

        return {
          error: result[0] as CurveError,
          newSpotPrice: result[1] as bigint,
          newDelta: result[2] as bigint,
          inputAmount: result[3] as bigint,
          protocolFee: result[4] as bigint,
          royaltyAmount: result[5] as bigint,
        }
      } catch (error) {
        console.error('Error fetching buy quote:', error)
        return null
      }
    },
    enabled: !!pairAddress && assetId !== undefined && numItems > 0,
    staleTime: 10000, // 10 seconds
  })
}

