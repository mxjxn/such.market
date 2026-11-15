import { request, gql } from 'graphql-request'
import { Address } from 'viem'

// Subgraph endpoints
const SUBGRAPH_ENDPOINTS = {
  8453: 'https://api.studio.thegraph.com/query/5440/such-lssvm/0.0.1', // Base Mainnet
  84532: 'https://api.studio.thegraph.com/query/5440/such-lssvm-sepolia/0.0.1', // Base Sepolia
} as const

export function getSubgraphEndpoint(chainId: number): string {
  const endpoint = SUBGRAPH_ENDPOINTS[chainId as keyof typeof SUBGRAPH_ENDPOINTS]
  if (!endpoint) {
    throw new Error(`Subgraph endpoint not configured for chain ${chainId}`)
  }
  return endpoint
}

// GraphQL types matching the subgraph schema
export interface Pool {
  id: string // Pool address
  nftContract: string
  tokenContract: string | null
  poolType: number // 0=TOKEN, 1=NFT, 2=TRADE
  poolVariant: number // 0=ERC721_ETH, 1=ERC721_ERC20, 2=ERC1155_ETH, 3=ERC1155_ERC20
  spotPrice: string // BigInt as string
  delta: string
  fee: string
  bondingCurve: string
  assetRecipient: string | null
  owner: string
  createdAt: string
  createdAtBlock: string
  createdAtTx: string
  nftId: string | null // For ERC1155 pools
  currentTokenBalance: string | null
  currentNFTBalance: string | null
}

export interface Swap {
  id: string
  pool: Pool
  type: string // "buy" or "sell"
  nftIds: string[]
  nftAmount: string | null
  tokenAmount: string
  timestamp: string
  blockNumber: string
  txHash: string
  from: string
}

// Query to get pools by NFT contract address
const POOLS_BY_NFT_CONTRACT_QUERY = gql`
  query PoolsByNFTContract($nftContract: Bytes!, $first: Int!, $skip: Int!) {
    pools(
      where: { nftContract: $nftContract }
      first: $first
      skip: $skip
      orderBy: spotPrice
      orderDirection: asc
    ) {
      id
      nftContract
      tokenContract
      poolType
      poolVariant
      spotPrice
      delta
      fee
      bondingCurve
      assetRecipient
      owner
      createdAt
      createdAtBlock
      createdAtTx
      nftId
      currentTokenBalance
      currentNFTBalance
    }
  }
`

// Query to get a single pool by address
const POOL_BY_ID_QUERY = gql`
  query PoolById($id: ID!) {
    pool(id: $id) {
      id
      nftContract
      tokenContract
      poolType
      poolVariant
      spotPrice
      delta
      fee
      bondingCurve
      assetRecipient
      owner
      createdAt
      createdAtBlock
      createdAtTx
      nftId
      currentTokenBalance
      currentNFTBalance
    }
  }
`

// Query to get pools with swaps (for aggregated NFT view)
const POOLS_WITH_SWAPS_QUERY = gql`
  query PoolsWithSwaps($nftContract: Bytes!, $first: Int!, $skip: Int!) {
    pools(
      where: { nftContract: $nftContract }
      first: $first
      skip: $skip
      orderBy: spotPrice
      orderDirection: asc
    ) {
      id
      nftContract
      tokenContract
      poolType
      poolVariant
      spotPrice
      delta
      fee
      bondingCurve
      assetRecipient
      owner
      createdAt
      createdAtBlock
      createdAtTx
      nftId
      currentTokenBalance
      currentNFTBalance
      swaps(
        first: 100
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        type
        nftIds
        nftAmount
        tokenAmount
        timestamp
        blockNumber
        txHash
        from
      }
    }
  }
`

/**
 * Query pools for a given NFT contract address
 */
export async function queryPoolsByNFTContract(
  chainId: number,
  nftContract: Address,
  options?: { first?: number; skip?: number }
): Promise<Pool[]> {
  const endpoint = getSubgraphEndpoint(chainId)
  const first = options?.first ?? 100
  const skip = options?.skip ?? 0

  try {
    const data = await request<{ pools: Pool[] }>(endpoint, POOLS_BY_NFT_CONTRACT_QUERY, {
      nftContract: nftContract.toLowerCase(),
      first,
      skip,
    })
    return data.pools
  } catch (error) {
    console.error('Error querying subgraph for pools:', error)
    throw error
  }
}

/**
 * Query a single pool by its address
 */
export async function queryPoolById(chainId: number, poolAddress: Address): Promise<Pool | null> {
  const endpoint = getSubgraphEndpoint(chainId)

  try {
    const data = await request<{ pool: Pool | null }>(endpoint, POOL_BY_ID_QUERY, {
      id: poolAddress.toLowerCase(),
    })
    return data.pool
  } catch (error) {
    console.error('Error querying subgraph for pool:', error)
    throw error
  }
}

/**
 * Query pools with swap history (for aggregated NFT view)
 */
export async function queryPoolsWithSwaps(
  chainId: number,
  nftContract: Address,
  options?: { first?: number; skip?: number }
): Promise<Pool[]> {
  const endpoint = getSubgraphEndpoint(chainId)
  const first = options?.first ?? 100
  const skip = options?.skip ?? 0

  try {
    const data = await request<{ pools: Pool[] }>(endpoint, POOLS_WITH_SWAPS_QUERY, {
      nftContract: nftContract.toLowerCase(),
      first,
      skip,
    })
    return data.pools
  } catch (error) {
    console.error('Error querying subgraph for pools with swaps:', error)
    throw error
  }
}

