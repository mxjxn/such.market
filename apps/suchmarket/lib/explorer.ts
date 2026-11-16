import { Hash } from 'viem'
import { base, baseSepolia, mainnet } from 'viem/chains'

const TX_URL: Record<number, string> = {
  [base.id]: 'https://basescan.org/tx/',
  [baseSepolia.id]: 'https://sepolia.basescan.org/tx/',
  [mainnet.id]: 'https://etherscan.io/tx/',
}

export function getTxExplorerUrl(chainId: number, hash: Hash): string {
  const prefix = TX_URL[chainId] ?? 'https://basescan.org/tx/'
  return `${prefix}${hash}`
}