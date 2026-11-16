import { Address } from 'viem'
import { ERC1155_ABI, ERC721_ABI } from './contracts'
import { getPublicClient } from './rpc'

const ERC721_INTERFACE_ID = '0x80ac58cd'
const ERC1155_INTERFACE_ID = '0xd9b67a26'

const ERC165_ABI = [
  {
    inputs: [{ name: 'interfaceId', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export async function detectNftStandard(
  chainId: number,
  contract: Address
): Promise<'ERC721' | 'ERC1155' | 'UNKNOWN'> {
  const client = getPublicClient(chainId)
  try {
    const is1155 = await client.readContract({
      address: contract,
      abi: ERC165_ABI,
      functionName: 'supportsInterface',
      args: [ERC1155_INTERFACE_ID],
    })
    if (is1155) return 'ERC1155'
  } catch {
    /* fall through */
  }

  try {
    const is721 = await client.readContract({
      address: contract,
      abi: ERC165_ABI,
      functionName: 'supportsInterface',
      args: [ERC721_INTERFACE_ID],
    })
    if (is721) return 'ERC721'
  } catch {
    /* fall through */
  }

  return 'UNKNOWN'
}

export async function verifyTokenOwnership(
  chainId: number,
  contract: Address,
  tokenId: bigint,
  owner: Address,
  standard: 'ERC721' | 'ERC1155'
): Promise<boolean> {
  const client = getPublicClient(chainId)
  try {
    if (standard === 'ERC721') {
      const tokenOwner = (await client.readContract({
        address: contract,
        abi: ERC721_ABI,
        functionName: 'ownerOf',
        args: [tokenId],
      })) as Address
      return tokenOwner.toLowerCase() === owner.toLowerCase()
    }
    const balance = (await client.readContract({
      address: contract,
      abi: ERC1155_ABI,
      functionName: 'balanceOf',
      args: [owner, tokenId],
    })) as bigint
    return balance > 0n
  } catch {
    return false
  }
}