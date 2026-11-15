'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useConnect } from 'wagmi'
import { Address } from 'viem'
import { getPublicClient } from '@/lib/wagmi'
import { usePoolData } from '@/hooks/usePoolData'
import { useBuyQuote } from '@/hooks/useBuyQuote'
import { useTokenData } from '@/hooks/useTokenData'
import { LSSVM_ROUTER_ABI, LSSVM_PAIR_ABI, LSSVM_FACTORY_ABI, ERC20_ABI, getRouterAddress, getFactoryAddress, CurveError } from '@/lib/contracts'
import { TransactionStatus } from './TransactionStatus'
import { PriceQuote } from './PriceQuote'
import { CartItem } from '@/contexts/CartContext'

interface CheckoutDialogProps {
  isOpen: boolean
  onClose: () => void
  items: CartItem[]
  poolAddress: Address
  chainId: number
  isERC1155?: boolean
  poolNftId?: bigint
  onSuccess?: () => void
}

export function CheckoutDialog({
  isOpen,
  onClose,
  items,
  poolAddress,
  chainId,
  isERC1155,
  poolNftId,
  onSuccess,
}: CheckoutDialogProps) {
  const [slippageTolerance, setSlippageTolerance] = useState(5) // 5%
  
  const { address: userAddress, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()

  // Get pool data
  const { data: poolData } = usePoolData(poolAddress, chainId)
  const { data: tokenData } = useTokenData(poolData?.token, userAddress || undefined, chainId)
  const isETH = poolData?.token === '0x0000000000000000000000000000000000000000'

  // Calculate quote for cart items
  const erc721Items = items.filter(item => !item.isERC1155)
  const erc1155Item = items.find(item => item.isERC1155)
  
  // For quote: use first ERC721 item or ERC1155 item
  const quoteNFTId = isERC1155 && poolNftId !== null 
    ? poolNftId 
    : erc721Items.length > 0 
      ? erc721Items[0].nftId 
      : undefined
  const numItems = isERC1155 && erc1155Item
    ? erc1155Item.quantity
    : erc721Items.length

  const { data: buyQuote, isLoading: quoteLoading } = useBuyQuote(
    poolAddress,
    quoteNFTId,
    numItems || 0,
    chainId
  )

  const {
    writeContract,
    data: hash,
    error: writeError,
    isPending: isWriting,
  } = useWriteContract()

  // ERC20 approval state - use separate writeContract calls tracked by mode
  const [isApprovalMode, setIsApprovalMode] = useState(false)
  const approvalHash = isApprovalMode ? hash : undefined

  const {
    isLoading: isApprovalConfirming,
    isSuccess: isApprovalSuccess,
    error: approvalTxError,
  } = useWaitForTransactionReceipt({
    hash: approvalHash as `0x${string}` | undefined,
  })

  // Log writeContract errors
  useEffect(() => {
    if (writeError) {
      console.error('writeContract error:', writeError)
    }
  }, [writeError])

  // Log when hash is set (transaction initiated)
  useEffect(() => {
    if (hash) {
      console.log('Transaction hash received:', hash)
    }
  }, [hash])

  const {
    isLoading: isConfirming,
    isSuccess,
    error: txError,
  } = useWaitForTransactionReceipt({
    hash,
  })

  // Close dialog and call onSuccess after successful purchase
  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 2000) // Give user time to see success message
    }
  }, [isSuccess, onSuccess, onClose])

  const handleCheckout = async () => {
    console.log('=== handleCheckout called ===')
    console.log('poolData:', !!poolData)
    console.log('userAddress:', userAddress)
    console.log('buyQuote:', buyQuote)
    console.log('items:', items)

    if (!poolData || !userAddress || !buyQuote) {
      const missing = []
      if (!poolData) missing.push('poolData')
      if (!userAddress) missing.push('userAddress')
      if (!buyQuote) missing.push('buyQuote')
      alert(`Missing required data: ${missing.join(', ')}. Please ensure you are connected and the pool is loaded.`)
      return
    }

    if (buyQuote.error !== CurveError.OK) {
      alert(`Cannot buy: Quote error ${buyQuote.error}. Please check the NFT IDs and try again.`)
      return
    }

    const client = getPublicClient(chainId)

    // Prepare NFT IDs and quantity
    const nftIds = erc721Items.map(item => item.nftId)
    const quantity = isERC1155 && erc1155Item
      ? BigInt(erc1155Item.quantity)
      : BigInt(nftIds.length)
    const assetId: bigint = isERC1155 && poolNftId != null
      ? poolNftId
      : nftIds.length > 0
        ? nftIds[0]!
        : 0n

    // Get fresh quote
    try {
      const freshQuote = await client.readContract({
        address: poolAddress,
        abi: LSSVM_PAIR_ABI,
        functionName: 'getBuyNFTQuote',
        args: [assetId, quantity],
      })

      const quoteError = freshQuote[0] as CurveError
      if (quoteError !== CurveError.OK) {
        alert(`Quote error ${quoteError}. The pool state may have changed. Please try again.`)
        return
      }

      const routerQuoteInputAmount = freshQuote[3] as bigint
      const finalMaxCost = (routerQuoteInputAmount * BigInt(100 + slippageTolerance)) / BigInt(100)
      const routerAddress = getRouterAddress(chainId)
      const factoryAddress = getFactoryAddress(chainId)

      // Check router status
      const routerStatus = await client.readContract({
        address: factoryAddress,
        abi: LSSVM_FACTORY_ABI,
        functionName: 'routerStatus',
        args: [routerAddress],
      })

      if (!routerStatus[0]) {
        alert(`Router ${routerAddress} is not whitelisted. Please contact the protocol admin.`)
        return
      }

      const isETHPair = poolData.token === '0x0000000000000000000000000000000000000000'

      console.log('=== CHECKOUT DEBUG ===')
      console.log('isETHPair:', isETHPair)
      console.log('isERC1155:', isERC1155)
      console.log('poolNftId:', poolNftId?.toString())
      console.log('nftIds:', nftIds.map(id => id.toString()))
      console.log('quantity:', quantity.toString())
      console.log('finalMaxCost:', finalMaxCost.toString())
      console.log('routerAddress:', routerAddress)
      console.log('userAddress:', userAddress)

      if (isETHPair) {
        if (isERC1155 && poolNftId !== null) {
          // ERC1155 ETH pair - call pair directly
          const pairSwapArgs = [
            [BigInt(erc1155Item?.quantity || 1)],
            finalMaxCost,
            userAddress,
            false,
            '0x0000000000000000000000000000000000000000' as Address,
          ] as const

          console.log('Calling ERC1155 ETH pair directly:', {
            address: poolAddress,
            functionName: 'swapTokenForSpecificNFTs',
            args: pairSwapArgs,
            value: finalMaxCost.toString(),
          })

          console.log('About to call writeContract for ERC1155 ETH pair')
          writeContract({
            address: poolAddress,
            abi: LSSVM_PAIR_ABI,
            functionName: 'swapTokenForSpecificNFTs',
            args: pairSwapArgs,
            value: finalMaxCost,
          })
          console.log('writeContract called for ERC1155 ETH pair')
        } else {
          // ERC721 ETH pair - use router
          const routerNftIds = nftIds.map(id => BigInt(id))
          const swapArgs = [
            [{ pair: poolAddress, nftIds: routerNftIds }],
            userAddress,
            userAddress,
            BigInt(Math.floor(Date.now() / 1000) + 3600),
          ] as const

          console.log('Calling router swapETHForSpecificNFTs:', {
            address: routerAddress,
            functionName: 'swapETHForSpecificNFTs',
            args: swapArgs,
            value: finalMaxCost.toString(),
          })

          console.log('About to call writeContract for ERC721 ETH via router')
          writeContract({
            address: routerAddress,
            abi: LSSVM_ROUTER_ABI,
            functionName: 'swapETHForSpecificNFTs',
            args: swapArgs,
            value: finalMaxCost,
          })
          console.log('writeContract called for ERC721 ETH via router')
        }
      } else {
        // ERC20 pair - check approval first
        const tokenAddress = poolData.token as Address
        const approvalTarget = isERC1155 ? poolAddress : routerAddress
        const currentAllowance = await client.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [userAddress, approvalTarget],
        }) as bigint

        console.log('ERC20 allowance check:', {
          tokenAddress,
          approvalTarget,
          currentAllowance: currentAllowance.toString(),
          required: finalMaxCost.toString(),
        })

        if (currentAllowance < finalMaxCost) {
          // Need to approve tokens first
          console.log('Insufficient allowance, requesting approval...')
          const approvalAmount = finalMaxCost * BigInt(2) // Approve 2x to have buffer
          
          // Check if approval is already in progress
          if (isApprovalMode && (isWriting || isApprovalConfirming)) {
            alert('Approval transaction is already in progress. Please wait for it to complete, then click "Complete Purchase" again.')
            return
          }

          // Check if approval just succeeded
          if (isApprovalMode && isApprovalSuccess) {
            // Reset and continue with purchase
            setIsApprovalMode(false)
            // Fall through to continue with purchase
          } else {
            // Request approval
            setIsApprovalMode(true)
            console.log('Calling writeContract for approval:', {
              address: tokenAddress,
              functionName: 'approve',
              args: [approvalTarget, approvalAmount.toString()],
            })
            
            writeContract({
              address: tokenAddress,
              abi: ERC20_ABI,
              functionName: 'approve',
              args: [approvalTarget, approvalAmount],
            })
            
            alert('Please approve the token spending in your wallet. Once approved, click "Complete Purchase" again.')
            return
          }
        }

        if (isERC1155 && poolNftId !== null) {
          // ERC1155 ERC20 pair - call pair directly
          const pairSwapArgs = [
            [BigInt(erc1155Item?.quantity || 1)],
            finalMaxCost,
            userAddress,
            false,
            '0x0000000000000000000000000000000000000000' as Address,
          ] as const

          console.log('Calling ERC1155 ERC20 pair directly:', {
            address: poolAddress,
            functionName: 'swapTokenForSpecificNFTs',
            args: pairSwapArgs,
          })

          console.log('About to call writeContract for ERC1155 ERC20 pair')
          writeContract({
            address: poolAddress,
            abi: LSSVM_PAIR_ABI,
            functionName: 'swapTokenForSpecificNFTs',
            args: pairSwapArgs,
          })
          console.log('writeContract called for ERC1155 ERC20 pair')
        } else {
          // ERC721 ERC20 pair - use router
          const routerNftIds = nftIds.map(id => BigInt(id))
          const swapArgs = [
            [{ pair: poolAddress, nftIds: routerNftIds }],
            finalMaxCost,
            userAddress,
            BigInt(Math.floor(Date.now() / 1000) + 3600),
          ] as const

          console.log('Calling router swapERC20ForSpecificNFTs:', {
            address: routerAddress,
            functionName: 'swapERC20ForSpecificNFTs',
            args: swapArgs,
          })

          console.log('About to call writeContract for ERC721 ERC20 via router')
          writeContract({
            address: routerAddress,
            abi: LSSVM_ROUTER_ABI,
            functionName: 'swapERC20ForSpecificNFTs',
            args: swapArgs,
          })
          console.log('writeContract called for ERC721 ERC20 via router')
        }
      }
      console.log('========================')
    } catch (error: any) {
      console.error('Error during checkout:', error)
      alert(`Transaction failed: ${error?.message || 'Unknown error'}. Please check the console for details.`)
    }
  }

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900">Checkout</h2>
            {!isWriting && !isConfirming && (
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close checkout"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Cart Items Summary */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Items ({totalItems})</h3>
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div
                    key={`${item.poolAddress}-${item.nftId}-${index}`}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="w-12 h-12 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                      {item.metadata?.image ? (
                        <img
                          src={item.metadata.image}
                          alt={item.metadata.name || `NFT #${item.nftId.toString()}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {item.metadata?.name || `NFT #${item.nftId.toString()}`}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">#{item.nftId.toString()}</p>
                    </div>
                    <div className="text-sm font-semibold text-gray-900">
                      {item.quantity}x
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Wallet Connection */}
            {!userAddress && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 mb-3">Please connect your wallet to continue</p>
                <button
                  onClick={() => {
                    const farcasterConnector = connectors.find(
                      c => c.id === 'farcaster' || c.name?.toLowerCase().includes('farcaster')
                    )
                    if (farcasterConnector) {
                      connect({ connector: farcasterConnector })
                    }
                  }}
                  disabled={isConnecting}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50"
                >
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              </div>
            )}

            {/* Price Quote */}
            {buyQuote && userAddress && (
              <div>
                <PriceQuote
                  label="Purchase Total"
                  totalAmount={buyQuote.inputAmount}
                  protocolFee={buyQuote.protocolFee}
                  royaltyAmount={buyQuote.royaltyAmount}
                  error={buyQuote.error}
                  decimals={isETH ? 18 : tokenData?.decimals || 18}
                />
                {quoteLoading && (
                  <p className="text-xs text-gray-500 mt-2">Updating quote...</p>
                )}
              </div>
            )}

            {/* Slippage Tolerance */}
            {userAddress && (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Slippage Tolerance: <span className="text-blue-600">{slippageTolerance}%</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={slippageTolerance}
                  onChange={(e) => setSlippageTolerance(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  disabled={isWriting || isConfirming}
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1%</span>
                  <span>10%</span>
                </div>
              </div>
            )}

            {/* Approval Status */}
            {(isApprovalMode && (isWriting || isApprovalConfirming || isApprovalSuccess || writeError || approvalTxError)) && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Token Approval</h4>
                <TransactionStatus
                  status={
                    isWriting || isApprovalConfirming
                      ? 'pending'
                      : isApprovalSuccess
                        ? 'success'
                        : writeError || approvalTxError
                          ? 'error'
                          : 'idle'
                  }
                  hash={approvalHash}
                  error={(writeError || approvalTxError) as Error | null}
                />
                {isApprovalSuccess && (
                  <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">
                      ✓ Approval confirmed! You can now complete your purchase.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Transaction Status */}
            {!isApprovalMode && (isWriting || isConfirming || isSuccess || writeError || txError || hash) && (
              <div>
                <TransactionStatus
                  status={
                    isWriting || isConfirming
                      ? 'pending'
                      : isSuccess
                        ? 'success'
                        : writeError || txError
                          ? 'error'
                          : hash
                            ? 'pending'
                            : 'idle'
                  }
                  hash={hash}
                  error={(writeError || txError) as Error | null}
                />
                {writeError && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">
                      Error: {writeError instanceof Error ? writeError.message : String(writeError)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-6">
            {userAddress ? (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('Checkout button clicked')
                  handleCheckout()
                }}
                disabled={!buyQuote || buyQuote.error !== CurveError.OK || isWriting || isConfirming || !poolData || (isApprovalMode && !isApprovalSuccess)}
                className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isWriting || isConfirming
                  ? (isApprovalMode ? 'Approving Tokens...' : 'Processing Transaction...')
                  : isSuccess
                    ? 'Purchase Complete!'
                    : isApprovalMode && isApprovalSuccess
                      ? 'Approval Complete - Click to Purchase'
                      : isApprovalMode && (isWriting || isApprovalConfirming)
                        ? 'Waiting for Approval...'
                        : !poolData
                          ? 'Loading pool data...'
                          : !buyQuote
                            ? 'Loading quote...'
                            : buyQuote.error !== CurveError.OK
                              ? `Cannot Checkout: ${buyQuote.error || 'Unknown error'}`
                              : `Complete Purchase (${totalItems} ${totalItems === 1 ? 'item' : 'items'})`}
              </button>
            ) : (
              <button
                onClick={() => {
                  const farcasterConnector = connectors.find(
                    c => c.id === 'farcaster' || c.name?.toLowerCase().includes('farcaster')
                  )
                  if (farcasterConnector) {
                    connect({ connector: farcasterConnector })
                  }
                }}
                disabled={isConnecting}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet to Continue'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

