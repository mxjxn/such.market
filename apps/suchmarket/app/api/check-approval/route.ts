import { NextRequest, NextResponse } from 'next/server'
import { Address, isAddress, createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
import { ERC721_ABI } from '@/lib/contracts'

// Get RPC URL from environment or use default
const BASE_RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || process.env.BASE_RPC_URL || 'https://mainnet.base.org'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nftAddress, owner, operator, chainId } = body

    if (!isAddress(nftAddress) || !isAddress(owner) || !isAddress(operator)) {
      return NextResponse.json(
        { error: 'Invalid addresses' },
        { status: 400 }
      )
    }

    // Currently only supporting Base Mainnet
    if (chainId !== base.id) {
      return NextResponse.json(
        { error: `Unsupported chain: ${chainId}. Only Base Mainnet (${base.id}) is currently supported.` },
        { status: 400 }
      )
    }

    const publicClient = createPublicClient({
      chain: base,
      transport: http(BASE_RPC_URL),
    })

    const isApproved = await publicClient.readContract({
      address: nftAddress as Address,
      abi: ERC721_ABI,
      functionName: 'isApprovedForAll',
      args: [owner as Address, operator as Address],
    })

    return NextResponse.json({ isApproved })
  } catch (error) {
    console.error('Error checking approval:', error)
    return NextResponse.json(
      { error: 'Failed to check approval' },
      { status: 500 }
    )
  }
}

