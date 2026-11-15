'use client'

import { Address } from 'viem'
import { getPublicClient } from './wagmi'
import { ERC721_ABI, ERC1155_ABI } from './contracts'
import { CONFIG } from './config'

export interface NFTMetadata {
  name?: string
  description?: string
  image?: string
  attributes?: Array<{ trait_type?: string; value?: any; [key: string]: any }>
  [key: string]: any
}

/**
 * Resolve IPFS URL to gateway URL
 */
export function resolveIPFSUrl(uri: string): string {
  if (!uri) return uri
  
  // Handle ipfs:// protocol
  if (uri.startsWith('ipfs://')) {
    const ipfsHash = uri.replace('ipfs://', '')
    const ipfsGateway = CONFIG.IPFS_URL || 'https://ipfs.io'
    // Remove trailing slash if present
    const gateway = ipfsGateway.replace(/\/$/, '')
    return `${gateway}/ipfs/${ipfsHash}`
  }
  
  // Handle /ipfs/ path format
  if (uri.includes('/ipfs/')) {
    const ipfsHash = uri.split('/ipfs/')[1]?.split('/')[0]
    if (ipfsHash) {
      const ipfsGateway = CONFIG.IPFS_URL || 'https://ipfs.io'
      // Remove trailing slash if present
      const gateway = ipfsGateway.replace(/\/$/, '')
      return `${gateway}/ipfs/${ipfsHash}`
    }
  }
  
  return uri
}

/**
 * Fetch metadata from a URI (HTTP or IPFS)
 */
export async function fetchMetadataFromURI(uri: string): Promise<NFTMetadata | null> {
  if (!uri) return null
  
  try {
    // Resolve IPFS URLs
    const resolvedUri = resolveIPFSUrl(uri)
    
    // Fetch metadata
    const response = await fetch(resolvedUri)
    if (!response.ok) {
      console.error(`Failed to fetch metadata from ${resolvedUri}: ${response.statusText}`)
      return null
    }
    
    const metadata = await response.json()
    
    // Resolve image URL if it's IPFS
    if (metadata.image) {
      metadata.image = resolveIPFSUrl(metadata.image)
    }
    
    return metadata
  } catch (error) {
    console.error(`Error fetching metadata from ${uri}:`, error)
    return null
  }
}

/**
 * Fetch ERC721 metadata URI by trying multiple methods
 */
export async function fetchERC721MetadataURI(
  nftAddress: Address,
  tokenId: bigint,
  chainId: number
): Promise<string | null> {
  const client = getPublicClient(chainId)
  
  // Try tokenURI first (most common)
  try {
    const uri = await client.readContract({
      address: nftAddress,
      abi: ERC721_ABI,
      functionName: 'tokenURI',
      args: [tokenId],
    })
    if (uri && typeof uri === 'string' && uri.trim() !== '') {
      return uri as string
    }
  } catch (error) {
    console.log(`tokenURI failed for ${nftAddress} token ${tokenId}:`, error)
  }
  
  // Try uri as fallback
  try {
    const uri = await client.readContract({
      address: nftAddress,
      abi: ERC721_ABI,
      functionName: 'uri',
      args: [tokenId],
    })
    if (uri && typeof uri === 'string' && uri.trim() !== '') {
      return uri as string
    }
  } catch (error) {
    console.log(`uri failed for ${nftAddress} token ${tokenId}:`, error)
  }
  
  // Try metadataURI as last fallback
  try {
    const uri = await client.readContract({
      address: nftAddress,
      abi: ERC721_ABI,
      functionName: 'metadataURI',
      args: [tokenId],
    })
    if (uri && typeof uri === 'string' && uri.trim() !== '') {
      return uri as string
    }
  } catch (error) {
    console.log(`metadataURI failed for ${nftAddress} token ${tokenId}:`, error)
  }
  
  return null
}

/**
 * Fetch ERC1155 metadata URI
 */
export async function fetchERC1155MetadataURI(
  nftAddress: Address,
  tokenId: bigint,
  chainId: number
): Promise<string | null> {
  const client = getPublicClient(chainId)
  
  try {
    const uri = await client.readContract({
      address: nftAddress,
      abi: ERC1155_ABI,
      functionName: 'uri',
      args: [tokenId],
    })
    
    if (!uri || typeof uri !== 'string' || uri.trim() === '') {
      return null
    }
    
    // ERC1155 uri() can return a template with {id} placeholder
    // Replace {id} with the tokenId (padded to 64 hex chars)
    let resolvedUri = uri as string
    if (resolvedUri.includes('{id}')) {
      const paddedId = tokenId.toString(16).padStart(64, '0')
      resolvedUri = resolvedUri.replace('{id}', paddedId)
    }
    
    return resolvedUri
  } catch (error) {
    console.error(`Error fetching ERC1155 URI for ${nftAddress} token ${tokenId}:`, error)
    return null
  }
}

/**
 * Fetch complete NFT metadata (ERC721)
 */
export async function fetchERC721Metadata(
  nftAddress: Address,
  tokenId: bigint,
  chainId: number
): Promise<NFTMetadata | null> {
  const uri = await fetchERC721MetadataURI(nftAddress, tokenId, chainId)
  if (!uri) return null
  
  return await fetchMetadataFromURI(uri)
}

/**
 * Fetch complete NFT metadata (ERC1155)
 */
export async function fetchERC1155Metadata(
  nftAddress: Address,
  tokenId: bigint,
  chainId: number
): Promise<NFTMetadata | null> {
  const uri = await fetchERC1155MetadataURI(nftAddress, tokenId, chainId)
  if (!uri) return null
  
  return await fetchMetadataFromURI(uri)
}

