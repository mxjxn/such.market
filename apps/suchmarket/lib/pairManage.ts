/** ABI fragments for pool owner management (deposit / withdraw / params). */
export const PAIR_MANAGE_ABI = [
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint128', name: 'newSpotPrice', type: 'uint128' }],
    name: 'changeSpotPrice',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint128', name: 'newDelta', type: 'uint128' }],
    name: 'changeDelta',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint96', name: 'newFee', type: 'uint96' }],
    name: 'changeFee',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'a', type: 'address' },
      { internalType: 'uint256[]', name: 'nftIds', type: 'uint256[]' },
    ],
    name: 'withdrawERC721',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'amount', type: 'uint256' }],
    name: 'withdrawERC20',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'withdrawETH',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

export const FACTORY_DEPOSIT_ABI = [
  {
    inputs: [
      { internalType: 'address', name: '_nft', type: 'address' },
      { internalType: 'uint256[]', name: 'ids', type: 'uint256[]' },
      { internalType: 'address', name: 'recipient', type: 'address' },
    ],
    name: 'depositNFTs',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const
