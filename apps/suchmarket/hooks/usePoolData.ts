import { useQuery } from '@tanstack/react-query'
import { Address } from 'viem'
import { fetchPoolData } from '@/lib/pool'

export function usePoolData(pairAddress: Address | undefined, chainId: number) {
  return useQuery({
    queryKey: ['poolData', pairAddress, chainId],
    queryFn: () => {
      if (!pairAddress) throw new Error('Pair address is required')
      return fetchPoolData(pairAddress, chainId)
    },
    enabled: !!pairAddress,
    staleTime: 30000, // 30 seconds
  })
}

