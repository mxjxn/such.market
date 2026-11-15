import { useQuery } from '@tanstack/react-query'
import { Address, zeroAddress } from 'viem'
import { getPublicClient } from '@/lib/wagmi'
import { ERC20_ABI } from '@/lib/contracts'

export interface TokenData {
  symbol: string
  decimals: number
  balance: bigint
}

export function useTokenData(
  tokenAddress: Address | undefined,
  userAddress: Address | undefined,
  chainId: number
) {
  return useQuery({
    queryKey: ['tokenData', tokenAddress, userAddress, chainId],
    queryFn: async (): Promise<TokenData | null> => {
      if (!tokenAddress) return null

      // Handle ETH pairs (zero address)
      if (tokenAddress === zeroAddress || tokenAddress === '0x0000000000000000000000000000000000000000') {
        // For ETH, we can't easily get balance without the user's address and making a provider call
        // But we can return ETH metadata
        return {
          symbol: 'ETH',
          decimals: 18,
          balance: 0n, // Balance would need to be fetched separately via getBalance
        }
      }

      try {
        const client = getPublicClient(chainId)
        const [symbol, decimals, balance] = await Promise.all([
          client.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'symbol',
          }),
          client.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'decimals',
          }),
          userAddress
            ? client.readContract({
                address: tokenAddress,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [userAddress],
              })
            : Promise.resolve(0n),
        ])

        return {
          symbol: symbol as string,
          decimals: decimals as number,
          balance: balance as bigint,
        }
      } catch (error) {
        console.error('Error fetching token data:', error)
        return null
      }
    },
    enabled: !!tokenAddress,
    staleTime: 30000, // 30 seconds
  })
}

