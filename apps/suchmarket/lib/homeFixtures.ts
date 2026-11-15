import type { PoolListItem } from '@/components/PoolListCard'
import { SAMPLE_ART } from '@/lib/sampleArt'

/** Clearly labeled sample pools for homepage preview / empty screenshots. */
export const SAMPLE_POOLS: PoolListItem[] = [
  {
    poolAddress: '0xSamplePool000000000000000000000001',
    nft: '0xSampleNft000000000000000000000001',
    poolType: 2,
    spotPrice: '10000000000000000',
    delta: '1000000000000000',
    fee: '50000000000000000',
    curveType: 'LINEAR',
    owner: null,
    collectionName: 'Sunset Blocks',
    imageUrl: SAMPLE_ART[0],
    isSample: true,
  },
  {
    poolAddress: '0xSamplePool000000000000000000000002',
    nft: '0xSampleNft000000000000000000000002',
    poolType: 1,
    spotPrice: '25000000000000000',
    delta: '2000000000000000',
    fee: '100000000000000000',
    curveType: 'LINEAR',
    owner: null,
    collectionName: 'Sky Dunes',
    imageUrl: SAMPLE_ART[1],
    isSample: true,
  },
  {
    poolAddress: '0xSamplePool000000000000000000000003',
    nft: '0xSampleNft000000000000000000000003',
    poolType: 0,
    spotPrice: '5000000000000000',
    delta: '500000000000000',
    fee: '0',
    curveType: 'LINEAR',
    owner: null,
    collectionName: 'Tilted Squares',
    imageUrl: SAMPLE_ART[2],
    isSample: true,
  },
  {
    poolAddress: '0xSamplePool000000000000000000000004',
    nft: '0xSampleNft000000000000000000000004',
    poolType: 2,
    spotPrice: '42000000000000000',
    delta: '3000000000000000',
    fee: '25000000000000000',
    curveType: 'LINEAR',
    owner: null,
    collectionName: 'Orbital Cream',
    imageUrl: SAMPLE_ART[3],
    isSample: true,
  },
  {
    poolAddress: '0xSamplePool000000000000000000000005',
    nft: '0xSampleNft000000000000000000000005',
    poolType: 1,
    spotPrice: '8000000000000000',
    delta: '800000000000000',
    fee: '75000000000000000',
    curveType: 'LINEAR',
    owner: null,
    collectionName: 'Cobalt Rush',
    imageUrl: SAMPLE_ART[4],
    isSample: true,
  },
  {
    poolAddress: '0xSamplePool000000000000000000000006',
    nft: '0xSampleNft000000000000000000000006',
    poolType: 2,
    spotPrice: '15000000000000000',
    delta: '1500000000000000',
    fee: '50000000000000000',
    curveType: 'LINEAR',
    owner: null,
    collectionName: 'Triangle Party',
    imageUrl: SAMPLE_ART[5],
    isSample: true,
  },
]

export interface SampleAuction {
  id: string
  title: string
  lotLabel: string
  currentBid: string
  endsIn: string
  imageUrl?: string
  href?: string
}

export const SAMPLE_AUCTIONS: SampleAuction[] = [
  {
    id: 'sample-a1',
    title: 'Study in ochre #12',
    lotLabel: 'English · Lot 14',
    currentBid: '0.42 ETH',
    endsIn: '2d 4h',
    imageUrl: SAMPLE_ART[0],
  },
  {
    id: 'sample-a2',
    title: 'Night terrace (edition)',
    lotLabel: 'English · Lot 9',
    currentBid: '0.18 ETH',
    endsIn: '11h',
    imageUrl: SAMPLE_ART[4],
  },
  {
    id: 'sample-a3',
    title: 'Untitled grid',
    lotLabel: 'English · Lot 3',
    currentBid: '1.05 ETH',
    endsIn: '5d',
    imageUrl: SAMPLE_ART[2],
  },
]

export function isHomePreviewMode(searchPreview: string | null): boolean {
  if (searchPreview === '1' || searchPreview === 'true') return true
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_HOME_PREVIEW === '1') {
    return true
  }
  return false
}

/** Fixture for pool detail preview page */
export const PREVIEW_POOL_DETAIL = {
  chainId: 8453,
  poolAddress: '0xSamplePool000000000000000000000001' as const,
  collectionName: 'Sunset Blocks',
  imageUrl: SAMPLE_ART[0],
  poolType: 2,
  spotPrice: '10000000000000000',
  delta: '1000000000000000',
  fee: '50000000000000000',
  curveType: 'LINEAR' as const,
  nft: '0xSampleNft000000000000000000000001',
}
