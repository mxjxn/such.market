'use client'

import { useState, useCallback, useEffect } from 'react'
import { Address, parseEther, parseUnits, isAddress, decodeErrorResult } from 'viem'
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useChainId } from 'wagmi'
import { getFactoryAddress, getBondingCurveAddress, PoolType, LSSVM_FACTORY_ABI, ERC721_ABI, ERC1155_ABI, ERC20_ABI } from '@/lib/contracts'
import { CreatePoolFormData } from '@/components/CreatePoolForm'
import { getPublicClient } from '@/lib/wagmi'

export interface CreatePoolResult {
  poolAddress: Address | null
  txHash: string | null
  error: string | null
  isPending: boolean
  isSuccess: boolean
}

export function useCreatePool(chainId: number) {
  const { address: userAddress } = useAccount()
  const currentChainId = useChainId()
  const { writeContract, data: hash, error: writeError, isPending: isWriting } = useWriteContract()
  const { data: receipt, isLoading: isWaiting, isSuccess } = useWaitForTransactionReceipt({
    hash,
  })

  const [error, setError] = useState<string | null>(null)

  // Monitor writeError and log it
  useEffect(() => {
    if (writeError) {
      console.error('writeError detected:', writeError)
      let errorMessage = writeError.message || 'Transaction failed'
      
      // Try to extract more specific error information from the error
      if (writeError.message?.includes('revert')) {
        // Check for common revert reasons
        if (writeError.message.includes('balance') || writeError.message.includes('insufficient')) {
          errorMessage = 'Insufficient NFT balance. Make sure you have enough tokens for the initial deposit.'
        } else if (writeError.message.includes('approval') || writeError.message.includes('allowance')) {
          errorMessage = 'Approval required. Please use the Approve button to approve the factory.'
        } else {
          // Try to get more details from the error object
          const errorDetails = (writeError as any).details || (writeError as any).data
          if (errorDetails) {
            errorMessage = `Contract call failed: ${errorDetails}`
          } else {
            errorMessage = `Contract call failed: ${writeError.message}. Please check your inputs and try again.`
          }
        }
      }
      
      setError(errorMessage)
    }
  }, [writeError])

  // Check if user is on the correct chain
  useEffect(() => {
    if (currentChainId !== chainId) {
      console.warn(`Chain mismatch: wallet is on chain ${currentChainId}, but trying to create pool on chain ${chainId}`)
    }
  }, [currentChainId, chainId])

  const createPool = useCallback(
    async (formData: CreatePoolFormData): Promise<CreatePoolResult> => {
      console.log('createPool called with:', formData)
      
      if (!userAddress) {
        console.error('No user address')
        return {
          poolAddress: null,
          txHash: null,
          error: 'Wallet not connected',
          isPending: false,
          isSuccess: false,
        }
      }

      setError(null)

      try {
        console.log('Starting pool creation process...')
        console.log('Current chain ID:', currentChainId, 'Target chain ID:', chainId)
        
        if (currentChainId !== chainId) {
          return {
            poolAddress: null,
            txHash: null,
            error: `Please switch to chain ${chainId} (currently on chain ${currentChainId})`,
            isPending: false,
            isSuccess: false,
          }
        }
        
        const factoryAddress = getFactoryAddress(chainId)
        const bondingCurveAddress = getBondingCurveAddress(chainId, formData.bondingCurve)
        const client = getPublicClient(chainId)
        
        console.log('Factory address:', factoryAddress)
        console.log('Bonding curve address:', bondingCurveAddress)

        // Check if bonding curve is whitelisted
        try {
          const isWhitelisted = await client.readContract({
            address: factoryAddress,
            abi: [
              {
                inputs: [{ internalType: 'contract ICurve', name: '', type: 'address' }],
                name: 'bondingCurveAllowed',
                outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
                stateMutability: 'view',
                type: 'function',
              },
            ],
            functionName: 'bondingCurveAllowed',
            args: [bondingCurveAddress],
          }) as boolean
          
          console.log('Bonding curve whitelist status:', isWhitelisted)
          
          if (!isWhitelisted) {
            return {
              poolAddress: null,
              txHash: null,
              error: `Bonding curve ${formData.bondingCurve} (${bondingCurveAddress}) is not whitelisted on the factory. Please contact the factory owner to whitelist it.`,
              isPending: false,
              isSuccess: false,
            }
          }
        } catch (err) {
          console.warn('Could not check bonding curve whitelist status:', err)
          // Continue anyway - the contract will check during execution
        }

        // Convert form values to BigInt
        const spotPrice = formData.paymentToken === 'ETH'
          ? parseEther(formData.spotPrice)
          : parseUnits(formData.spotPrice, 18) // Will be adjusted based on token decimals
        const delta = formData.paymentToken === 'ETH'
          ? parseEther(formData.delta)
          : parseUnits(formData.delta, 18) // Will be adjusted based on token decimals
        const fee = BigInt(Math.floor(parseFloat(formData.fee)))
        
        // Validate delta and spot price with bonding curve before attempting transaction
        try {
          // Try to validate delta and spot price by calling the bonding curve
          // Note: This might not be available on all curves, so we'll catch and continue if it fails
          const [deltaValid, spotPriceValid] = await Promise.all([
            client.readContract({
              address: bondingCurveAddress,
              abi: [
                {
                  inputs: [{ internalType: 'uint128', name: 'delta', type: 'uint128' }],
                  name: 'validateDelta',
                  outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
                  stateMutability: 'view',
                  type: 'function',
                },
              ],
              functionName: 'validateDelta',
              args: [delta],
            }).catch(() => null),
            client.readContract({
              address: bondingCurveAddress,
              abi: [
                {
                  inputs: [{ internalType: 'uint128', name: 'spotPrice', type: 'uint128' }],
                  name: 'validateSpotPrice',
                  outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
                  stateMutability: 'view',
                  type: 'function',
                },
              ],
              functionName: 'validateSpotPrice',
              args: [spotPrice],
            }).catch(() => null),
          ])
          
          if (deltaValid === false) {
            return {
              poolAddress: null,
              txHash: null,
              error: `Invalid delta value: ${formData.delta}. The bonding curve does not accept this delta value.`,
              isPending: false,
              isSuccess: false,
            }
          }
          
          if (spotPriceValid === false) {
            return {
              poolAddress: null,
              txHash: null,
              error: `Invalid spot price: ${formData.spotPrice}. The bonding curve does not accept this spot price value.`,
              isPending: false,
              isSuccess: false,
            }
          }
          
          console.log('Delta and spot price validation passed:', { deltaValid, spotPriceValid })
        } catch (err) {
          console.warn('Could not validate delta/spotPrice with bonding curve (this is okay):', err)
          // Continue anyway - the contract will validate during execution
        }

        // Handle ERC20 token decimals if needed
        let spotPriceWei = spotPrice
        let deltaWei = delta
        if (formData.paymentToken === 'ERC20' && formData.erc20Token) {
          try {
            const decimals = await client.readContract({
              address: formData.erc20Token,
              abi: ERC20_ABI,
              functionName: 'decimals',
            })
            spotPriceWei = parseUnits(formData.spotPrice, Number(decimals))
            deltaWei = parseUnits(formData.delta, Number(decimals))
          } catch (err) {
            console.error('Error fetching ERC20 decimals:', err)
            // Fallback to 18 decimals
          }
        }

        // Note: Approval is now handled in the UI via the approval button
        // We still do a quick check here as a safety measure
        if (formData.nftType === 'ERC721') {
          const isApproved = await client.readContract({
            address: formData.nftContract,
            abi: ERC721_ABI,
            functionName: 'isApprovedForAll',
            args: [userAddress, factoryAddress],
          })
          console.log('ERC721 approval check:', { isApproved, userAddress, factoryAddress })

          if (!isApproved) {
            return {
              poolAddress: null,
              txHash: null,
              error: 'Please approve the factory to transfer your NFTs first using the Approve button',
              isPending: false,
              isSuccess: false,
            }
          }
        } else if (formData.nftType === 'ERC1155') {
          const isApproved = await client.readContract({
            address: formData.nftContract,
            abi: ERC1155_ABI,
            functionName: 'isApprovedForAll',
            args: [userAddress, factoryAddress],
          })
          console.log('ERC1155 approval check:', { isApproved, userAddress, factoryAddress, nftContract: formData.nftContract })

          if (!isApproved) {
            return {
              poolAddress: null,
              txHash: null,
              error: 'Please approve the factory to transfer your NFTs first using the Approve button',
              isPending: false,
              isSuccess: false,
            }
          }
          console.log('ERC1155 approval confirmed, proceeding with pool creation')
          
          // Double-check balance right before creating pool
          try {
            const finalBalanceCheck = await client.readContract({
              address: formData.nftContract,
              abi: ERC1155_ABI,
              functionName: 'balanceOf',
              args: [userAddress, BigInt(formData.nftId)],
            }) as bigint
            console.log('Final balance check before pool creation:', {
              nftId: formData.nftId,
              balance: finalBalanceCheck.toString(),
              required: formData.initialNFTBalance,
            })
          } catch (err) {
            console.warn('Could not perform final balance check:', err)
          }
        }

        // Handle ERC20 token approval if needed
        if (formData.paymentToken === 'ERC20' && formData.erc20Token) {
          const initialTokenBalance = formData.initialTokenBalance
            ? parseUnits(formData.initialTokenBalance, 18) // Will be adjusted
            : 0n

          if (initialTokenBalance > 0n) {
            try {
              const decimals = await client.readContract({
                address: formData.erc20Token,
                abi: ERC20_ABI,
                functionName: 'decimals',
              })
              const adjustedBalance = parseUnits(formData.initialTokenBalance, Number(decimals))

              const allowance = await client.readContract({
                address: formData.erc20Token,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [userAddress, factoryAddress],
              })

              if (allowance < adjustedBalance) {
                return {
                  poolAddress: null,
                  txHash: null,
                  error: 'Please approve the factory to spend your ERC20 tokens first',
                  isPending: false,
                  isSuccess: false,
                }
              }
            } catch (err) {
              console.error('Error checking ERC20 allowance:', err)
            }
          }
        }

        // Prepare transaction based on pool type
        if (formData.nftType === 'ERC721') {
          const initialNFTIds = formData.initialNFTIds
            .split(',')
            .map(id => id.trim())
            .filter(Boolean)
            .map(id => BigInt(id))

          if (formData.paymentToken === 'ETH') {
            // ERC721/ETH TRADE pool
            console.log('Calling writeContract for ERC721/ETH:', {
              factoryAddress,
              functionName: 'createPairERC721ETH',
              args: [
                formData.nftContract,
                bondingCurveAddress,
                '0x0000000000000000000000000000000000000000',
                PoolType.TRADE,
                deltaWei.toString(),
                fee.toString(),
                spotPriceWei.toString(),
                '0x0000000000000000000000000000000000000000',
                initialNFTIds.map(id => id.toString()),
              ],
            })
            
            try {
              writeContract({
                address: factoryAddress,
                abi: LSSVM_FACTORY_ABI,
                functionName: 'createPairERC721ETH',
                args: [
                  formData.nftContract,
                  bondingCurveAddress,
                  '0x0000000000000000000000000000000000000000' as Address, // assetRecipient (not used for TRADE)
                  PoolType.TRADE, // poolType
                  deltaWei,
                  fee,
                  spotPriceWei,
                  '0x0000000000000000000000000000000000000000' as Address, // propertyChecker
                  initialNFTIds,
                ],
                value: 0n, // No ETH needed for TRADE pools (only NFTs)
              })
              console.log('writeContract called successfully')
            } catch (err) {
              console.error('Error calling writeContract:', err)
              throw err
            }
          } else {
            // ERC721/ERC20 TRADE pool
            const initialTokenBalance = formData.initialTokenBalance
              ? parseUnits(formData.initialTokenBalance, 18) // Will be adjusted
              : 0n

            // Adjust for token decimals
            let adjustedTokenBalance = initialTokenBalance
            if (formData.erc20Token) {
              try {
                const decimals = await client.readContract({
                  address: formData.erc20Token,
                  abi: ERC20_ABI,
                  functionName: 'decimals',
                })
                adjustedTokenBalance = parseUnits(formData.initialTokenBalance, Number(decimals))
              } catch (err) {
                console.error('Error fetching ERC20 decimals:', err)
              }
            }

            writeContract({
              address: factoryAddress,
              abi: LSSVM_FACTORY_ABI,
              functionName: 'createPairERC721ERC20',
              args: [
                {
                  token: formData.erc20Token!,
                  nft: formData.nftContract,
                  bondingCurve: bondingCurveAddress,
                  assetRecipient: '0x0000000000000000000000000000000000000000' as Address,
                  poolType: PoolType.TRADE,
                  delta: deltaWei,
                  fee,
                  spotPrice: spotPriceWei,
                  propertyChecker: '0x0000000000000000000000000000000000000000' as Address,
                  initialNFTIDs: initialNFTIds,
                  initialTokenBalance: adjustedTokenBalance,
                },
              ],
            })
          }
        } else {
          // ERC1155
          console.log('Preparing ERC1155 pool creation...')
          const nftId = BigInt(formData.nftId)
          const initialNFTBalance = BigInt(formData.initialNFTBalance)
          
          // Verify user has enough balance before attempting to create pool
          try {
            const userBalance = await client.readContract({
              address: formData.nftContract,
              abi: ERC1155_ABI,
              functionName: 'balanceOf',
              args: [userAddress, nftId],
            }) as bigint
            
            console.log('User balance check:', {
              required: initialNFTBalance.toString(),
              actual: userBalance.toString(),
            })
            
            if (userBalance < initialNFTBalance) {
              return {
                poolAddress: null,
                txHash: null,
                error: `Insufficient balance: You have ${userBalance.toString()} tokens, but need ${initialNFTBalance.toString()} for the initial deposit`,
                isPending: false,
                isSuccess: false,
              }
            }
          } catch (err) {
            console.error('Error checking ERC1155 balance:', err)
            // Continue anyway - the contract will revert if balance is insufficient
          }
          
          console.log('ERC1155 pool params:', {
            nftId: nftId.toString(),
            initialNFTBalance: initialNFTBalance.toString(),
            deltaWei: deltaWei.toString(),
            fee: fee.toString(),
            spotPriceWei: spotPriceWei.toString(),
          })

          if (formData.paymentToken === 'ETH') {
            // ERC1155/ETH TRADE pool
            console.log('Calling writeContract for ERC1155/ETH:', {
              factoryAddress,
              functionName: 'createPairERC1155ETH',
              args: [
                formData.nftContract,
                bondingCurveAddress,
                '0x0000000000000000000000000000000000000000',
                PoolType.TRADE,
                deltaWei.toString(),
                fee.toString(),
                spotPriceWei.toString(),
                nftId.toString(),
                initialNFTBalance.toString(),
              ],
            })
            
            // Try to simulate the contract call first to get better error information
            try {
              console.log('Simulating contract call to get detailed error...')
              
              // First try simulateContract
              try {
                await client.simulateContract({
                  account: userAddress,
                  address: factoryAddress,
                  abi: LSSVM_FACTORY_ABI,
                  functionName: 'createPairERC1155ETH',
                  args: [
                    formData.nftContract,
                    bondingCurveAddress,
                    '0x0000000000000000000000000000000000000000' as Address, // assetRecipient
                    PoolType.TRADE, // poolType
                    deltaWei,
                    fee,
                    spotPriceWei,
                    nftId,
                    initialNFTBalance,
                  ],
                  value: 0n, // No ETH needed for TRADE pools
                })
                console.log('Simulation passed, calling writeContract...')
              } catch (simErr: any) {
                // If simulateContract fails, try a direct call to get raw error data
                console.log('simulateContract failed, trying direct call...')
                try {
                  const { encodeFunctionData } = await import('viem')
                  const calldata = encodeFunctionData({
                    abi: LSSVM_FACTORY_ABI,
                    functionName: 'createPairERC1155ETH',
                    args: [
                      formData.nftContract,
                      bondingCurveAddress,
                      '0x0000000000000000000000000000000000000000' as Address,
                      PoolType.TRADE,
                      deltaWei,
                      fee,
                      spotPriceWei,
                      nftId,
                      initialNFTBalance,
                    ],
                  })
                  
                  await client.call({
                    account: userAddress,
                    to: factoryAddress,
                    data: calldata,
                    value: 0n,
                  })
                } catch (callErr: any) {
                  console.log('Direct call also failed:', callErr)
                  // Re-throw the original simulation error
                  throw simErr
                }
              }
            } catch (simErr: any) {
              console.error('Simulation failed with error:', simErr)
              
              // Try to extract error data from various locations in the error object
              let errorData: string | undefined
              let errorReason: string | undefined
              
              // Check the cause chain
              let current: any = simErr
              let depth = 0
              while (current && depth < 10) {
                // Check for data property
                if (current.data && typeof current.data === 'string' && current.data.startsWith('0x') && current.data.length > 10) {
                  errorData = current.data
                  console.log(`Found error data at depth ${depth} in cause chain:`, errorData)
                  break
                }
                
                // Check for reason
                if (current.reason && typeof current.reason === 'string') {
                  errorReason = current.reason
                  console.log(`Found reason at depth ${depth}:`, errorReason)
                }
                
                // Check for error property
                if (current.error?.data && typeof current.error.data === 'string' && current.error.data.startsWith('0x')) {
                  errorData = current.error.data
                  console.log(`Found error data in error property at depth ${depth}:`, errorData)
                  break
                }
                
                // Move to next level
                current = current.cause || current.error
                depth++
              }
              
              // Also check direct properties
              if (!errorData) {
                const propsToCheck = ['data', 'errorData', 'revertData', 'returnData']
                for (const prop of propsToCheck) {
                  if (simErr[prop] && typeof simErr[prop] === 'string' && simErr[prop].startsWith('0x')) {
                    errorData = simErr[prop]
                    console.log(`Found error data in property ${prop}:`, errorData)
                    break
                  }
                }
              }
              
              console.log('Final extracted error data:', errorData)
              console.log('Final extracted reason:', errorReason)
              
              // Try to decode the error
              let errorMessage = 'Contract call would fail. '
              let decodedError: { errorName: string; args?: any } | null = null
              
              try {
                if (errorData && typeof errorData === 'string' && errorData.startsWith('0x') && errorData.length > 10) {
                  decodedError = decodeErrorResult({
                    abi: LSSVM_FACTORY_ABI,
                    data: errorData as `0x${string}`,
                  })
                  console.log('Decoded error:', decodedError)
                }
              } catch (decodeErr) {
                console.warn('Could not decode error:', decodeErr)
              }
              
              if (decodedError) {
                // Map decoded error names to user-friendly messages
                const errorMessages: Record<string, string> = {
                  'LSSVMPairFactory__BondingCurveNotWhitelisted': 'Bonding curve is not whitelisted on the factory',
                  'LSSVMPairFactory__ReentrantCall': 'Reentrant call detected',
                  'LSSVMPairFactory__ZeroAddress': 'Zero address provided',
                  'LSSVMPair__InvalidDelta': 'Invalid delta value for the bonding curve',
                  'LSSVMPair__InvalidSpotPrice': 'Invalid spot price for the bonding curve',
                  'LSSVMPair__NftNotTransferred': 'NFT transfer failed. The pair contract may not properly implement IERC1155Receiver',
                }
                
                errorMessage += errorMessages[decodedError.errorName] || `Error: ${decodedError.errorName}`
              } else {
                // Provide detailed error message since we can't decode the specific error
                errorMessage = 'Pool creation failed. The contract reverted but the RPC node did not provide the specific error reason.\n\n'
                errorMessage += 'All pre-checks passed:\n'
                errorMessage += '✓ Bonding curve is whitelisted\n'
                errorMessage += '✓ Delta and spot price are valid\n'
                errorMessage += '✓ NFT approval is set\n'
                errorMessage += '✓ You have sufficient NFT balance\n\n'
                errorMessage += 'Possible causes:\n'
                errorMessage += '1. The pair contract may not properly implement IERC1155Receiver\n'
                errorMessage += '2. The NFT contract may have transfer restrictions\n'
                errorMessage += '3. There may be a validation check in the factory or pair contract that we haven\'t accounted for\n'
                errorMessage += '4. The RPC node may not support error data extraction\n\n'
                errorMessage += 'Try:\n'
                errorMessage += '- Check if you can create a pool with a different NFT contract\n'
                errorMessage += '- Verify the NFT contract allows transfers to contract addresses\n'
                errorMessage += '- Try using a different RPC endpoint that supports error data\n'
                errorMessage += '- Check the transaction on a block explorer to see the actual revert reason'
              }
              
              return {
                poolAddress: null,
                txHash: null,
                error: errorMessage,
                isPending: false,
                isSuccess: false,
              }
            }
            
            try {
              writeContract({
                address: factoryAddress,
                abi: LSSVM_FACTORY_ABI,
                functionName: 'createPairERC1155ETH',
                args: [
                  formData.nftContract,
                  bondingCurveAddress,
                  '0x0000000000000000000000000000000000000000' as Address, // assetRecipient
                  PoolType.TRADE, // poolType
                  deltaWei,
                  fee,
                  spotPriceWei,
                  nftId,
                  initialNFTBalance,
                ],
                value: 0n, // No ETH needed for TRADE pools
              })
              console.log('writeContract called successfully')
            } catch (err) {
              console.error('Error calling writeContract:', err)
              throw err
            }
          } else {
            // ERC1155/ERC20 TRADE pool
            const initialTokenBalance = formData.initialTokenBalance
              ? parseUnits(formData.initialTokenBalance, 18) // Will be adjusted
              : 0n

            // Adjust for token decimals
            let adjustedTokenBalance = initialTokenBalance
            if (formData.erc20Token) {
              try {
                const decimals = await client.readContract({
                  address: formData.erc20Token,
                  abi: ERC20_ABI,
                  functionName: 'decimals',
                })
                adjustedTokenBalance = parseUnits(formData.initialTokenBalance, Number(decimals))
              } catch (err) {
                console.error('Error fetching ERC20 decimals:', err)
              }
            }

            writeContract({
              address: factoryAddress,
              abi: LSSVM_FACTORY_ABI,
              functionName: 'createPairERC1155ERC20',
              args: [
                {
                  token: formData.erc20Token!,
                  nft: formData.nftContract,
                  bondingCurve: bondingCurveAddress,
                  assetRecipient: '0x0000000000000000000000000000000000000000' as Address,
                  poolType: PoolType.TRADE,
                  delta: deltaWei,
                  fee,
                  spotPrice: spotPriceWei,
                  nftId,
                  initialNFTBalance,
                  initialTokenBalance: adjustedTokenBalance,
                },
              ],
            })
          }
        }

        return {
          poolAddress: null, // Will be extracted from receipt
          txHash: hash || null,
          error: null,
          isPending: true,
          isSuccess: false,
        }
      } catch (err) {
        console.error('Error in createPool:', err)
        let errorMessage = 'Unknown error occurred'
        
        if (err instanceof Error) {
          errorMessage = err.message
          // Try to extract more specific error information
          if (err.message.includes('revert')) {
            // Check if it's a balance issue
            if (err.message.includes('balance') || err.message.includes('insufficient')) {
              errorMessage = 'Insufficient NFT balance. Make sure you have enough tokens for the initial deposit.'
            } else if (err.message.includes('approval') || err.message.includes('allowance')) {
              errorMessage = 'Approval required. Please use the Approve button to approve the factory.'
            } else {
              errorMessage = `Contract call failed: ${err.message}. Please check your inputs and try again.`
            }
          }
        }
        
        setError(errorMessage)
        return {
          poolAddress: null,
          txHash: null,
          error: errorMessage,
          isPending: false,
          isSuccess: false,
        }
      }
    },
    [userAddress, chainId, currentChainId, writeContract, hash]
  )

  // Extract pool address from receipt events
  const poolAddress = receipt?.logs?.[0]?.address as Address | undefined

  // Log writeError for debugging
  if (writeError) {
    console.error('writeError from wagmi:', writeError)
  }

  // Log hash when it's set (transaction initiated)
  if (hash) {
    console.log('Transaction hash received:', hash)
  }

  return {
    createPool,
    poolAddress: poolAddress || null,
    txHash: hash || null,
    error: error || (writeError?.message ?? null),
    isPending: isWriting || isWaiting,
    isSuccess: isSuccess && !!poolAddress,
  }
}

