'use client'

import { useState, useEffect } from 'react'
import { Address, isAddress, parseEther, formatUnits } from 'viem'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { getBondingCurveAddress, PoolType, BONDING_CURVES, ERC721_ABI, ERC1155_ABI, getFactoryAddress } from '@/lib/contracts'
import { ERC20_ABI } from '@/lib/contracts'
import { getPublicClient } from '@/lib/wagmi'
import { useERC1155TokenInfo } from '@/hooks/useERC1155TokenInfo'
import { useQuery } from '@tanstack/react-query'
import {
  DEFAULT_DELTA,
  DEFAULT_POOL_FEE_BPS,
  DEFAULT_SPOT_PRICE,
} from '@/lib/trader-defaults'

export interface CreatePoolFormData {
  nftType: 'ERC721' | 'ERC1155'
  paymentToken: 'ETH' | 'ERC20'
  nftContract: Address
  erc20Token: Address | null
  bondingCurve: 'LINEAR' | 'EXPONENTIAL' | 'XYK' | 'GDA'
  spotPrice: string // In ETH/ERC20 units (e.g., "1.0")
  delta: string // In ETH/ERC20 units
  fee: string // In basis points (e.g., "100" = 1%)
  // ERC721 fields
  initialNFTIds: string // Comma-separated token IDs
  // ERC1155 fields
  nftId: string
  initialNFTBalance: string
  // ERC20 fields
  initialTokenBalance: string
}

interface CreatePoolFormProps {
  chainId: number
  onSubmit: (data: CreatePoolFormData) => void
  isSubmitting?: boolean
  error?: string | null
  initialData?: Partial<CreatePoolFormData> | null
}

export function CreatePoolForm({ chainId, onSubmit, isSubmitting = false, error, initialData }: CreatePoolFormProps) {
  const { address: userAddress, isConnected } = useAccount()
  const { writeContract: writeApproval, data: approvalHash, isPending: isApproving } = useWriteContract()
  const { isSuccess: approvalSuccess } = useWaitForTransactionReceipt({
    hash: approvalHash,
  })
  
  const [formData, setFormData] = useState<CreatePoolFormData>({
    nftType: initialData?.nftType || 'ERC721',
    paymentToken: initialData?.paymentToken || 'ETH',
    nftContract: initialData?.nftContract || ('' as Address),
    erc20Token: initialData?.erc20Token || null,
    bondingCurve: initialData?.bondingCurve || 'LINEAR',
    spotPrice: initialData?.spotPrice || DEFAULT_SPOT_PRICE,
    delta: initialData?.delta || DEFAULT_DELTA,
    fee: initialData?.fee || String(DEFAULT_POOL_FEE_BPS),
    initialNFTIds: initialData?.initialNFTIds || '',
    nftId: initialData?.nftId || '0',
    initialNFTBalance: initialData?.initialNFTBalance || '0',
    initialTokenBalance: initialData?.initialTokenBalance || '0',
  })

  const [erc20Decimals, setErc20Decimals] = useState<number | null>(null)
  const [erc20Symbol, setErc20Symbol] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Update form when initialData first becomes available (from URL params)
  useEffect(() => {
    if (initialData && initialData.nftContract) {
      setFormData(prev => ({
        ...prev,
        nftContract: initialData.nftContract!,
        nftType: initialData.nftType || prev.nftType,
        paymentToken: initialData.paymentToken || prev.paymentToken,
        erc20Token: initialData.erc20Token !== undefined ? initialData.erc20Token : prev.erc20Token,
        bondingCurve: initialData.bondingCurve || prev.bondingCurve,
        spotPrice: initialData.spotPrice || prev.spotPrice,
        delta: initialData.delta || prev.delta,
        fee: initialData.fee || prev.fee,
        initialNFTIds: initialData.initialNFTIds !== undefined ? initialData.initialNFTIds : prev.initialNFTIds,
        nftId: initialData.nftId !== undefined ? initialData.nftId : prev.nftId,
        initialNFTBalance: initialData.initialNFTBalance !== undefined ? initialData.initialNFTBalance : prev.initialNFTBalance,
        initialTokenBalance: initialData.initialTokenBalance !== undefined ? initialData.initialTokenBalance : prev.initialTokenBalance,
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.nftContract]) // Only re-run when NFT contract changes

  // Fetch ERC1155 token info when NFT ID is entered
  const { tokenInfo, isLoading: loadingTokenInfo, isDebouncing } = useERC1155TokenInfo(
    formData.nftContract && isAddress(formData.nftContract) && formData.nftType === 'ERC1155'
      ? formData.nftContract
      : undefined,
    formData.nftId,
    chainId
  )

  // Auto-populate balance when token info is loaded
  useEffect(() => {
    if (tokenInfo && tokenInfo.balance > 0n && (!formData.initialNFTBalance || formData.initialNFTBalance === '0')) {
      setFormData(prev => ({ ...prev, initialNFTBalance: tokenInfo.balance.toString() }))
    }
  }, [tokenInfo, formData.initialNFTBalance])

  // Check approval status
  const factoryAddress = formData.nftContract && isAddress(formData.nftContract) ? getFactoryAddress(chainId) : null
  const { data: isApproved, refetch: refetchApproval } = useQuery<boolean>({
    queryKey: ['nftApproval', formData.nftContract, formData.nftType, userAddress, factoryAddress, chainId, approvalSuccess],
    queryFn: async () => {
      if (!formData.nftContract || !isAddress(formData.nftContract) || !userAddress || !factoryAddress) {
        return false
      }

      try {
        const client = getPublicClient(chainId)
        const abi = formData.nftType === 'ERC721' ? ERC721_ABI : ERC1155_ABI
        const approved = await client.readContract({
          address: formData.nftContract,
          abi,
          functionName: 'isApprovedForAll',
          args: [userAddress, factoryAddress],
        })
        return approved as boolean
      } catch (err) {
        console.error('Error checking approval:', err)
        return false
      }
    },
    enabled: !!formData.nftContract && isAddress(formData.nftContract) && !!userAddress && !!factoryAddress,
    staleTime: 10 * 1000, // 10 seconds
  })

  // Refetch approval when approval transaction succeeds
  useEffect(() => {
    if (approvalSuccess) {
      refetchApproval()
    }
  }, [approvalSuccess, refetchApproval])

  // Handle approval
  const handleApprove = () => {
    if (!formData.nftContract || !isAddress(formData.nftContract) || !factoryAddress) {
      return
    }

    const abi = formData.nftType === 'ERC721' ? ERC721_ABI : ERC1155_ABI
    writeApproval({
      address: formData.nftContract,
      abi,
      functionName: 'setApprovalForAll',
      args: [factoryAddress, true],
    })
  }

  // Fetch ERC20 token info when token address changes
  useEffect(() => {
    if (formData.paymentToken === 'ERC20' && formData.erc20Token && isAddress(formData.erc20Token)) {
      const fetchTokenInfo = async () => {
        try {
          const client = getPublicClient(chainId)
          const [decimals, symbol] = await Promise.all([
            client.readContract({
              address: formData.erc20Token!,
              abi: ERC20_ABI,
              functionName: 'decimals',
            }),
            client.readContract({
              address: formData.erc20Token!,
              abi: ERC20_ABI,
              functionName: 'symbol',
            }),
          ])
          setErc20Decimals(Number(decimals))
          setErc20Symbol(symbol)
        } catch (err) {
          console.error('Error fetching ERC20 token info:', err)
          setErc20Decimals(null)
          setErc20Symbol(null)
        }
      }
      fetchTokenInfo()
    } else {
      setErc20Decimals(null)
      setErc20Symbol(null)
    }
  }, [formData.paymentToken, formData.erc20Token, chainId])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // NFT contract validation
    if (!formData.nftContract || !isAddress(formData.nftContract)) {
      errors.nftContract = 'Valid NFT contract address is required'
    }

    // ERC20 token validation
    if (formData.paymentToken === 'ERC20') {
      if (!formData.erc20Token || !isAddress(formData.erc20Token)) {
        errors.erc20Token = 'Valid ERC20 token address is required'
      }
    }

    // Spot price validation
    const spotPriceNum = parseFloat(formData.spotPrice)
    if (isNaN(spotPriceNum) || spotPriceNum <= 0) {
      errors.spotPrice = 'Spot price must be a positive number'
    }

    // Delta validation
    const deltaNum = parseFloat(formData.delta)
    if (isNaN(deltaNum) || deltaNum <= 0) {
      errors.delta = 'Delta must be a positive number'
    }

    // Fee validation (for TRADE pools, fee can be 0-10000 basis points)
    const feeNum = parseFloat(formData.fee)
    if (isNaN(feeNum) || feeNum < 0 || feeNum > 10000) {
      errors.fee = 'Fee must be between 0 and 10000 basis points (0-100%)'
    }

    // ERC721 validation
    if (formData.nftType === 'ERC721') {
      if (!formData.initialNFTIds.trim()) {
        errors.initialNFTIds = 'At least one initial NFT ID is required'
      } else {
        const ids = formData.initialNFTIds.split(',').map(id => id.trim()).filter(Boolean)
        if (ids.length === 0) {
          errors.initialNFTIds = 'At least one initial NFT ID is required'
        }
        // Validate each ID is a valid number
        for (const id of ids) {
          if (isNaN(parseInt(id, 10))) {
            errors.initialNFTIds = `Invalid NFT ID: ${id}`
            break
          }
        }
      }
    }

    // ERC1155 validation
    if (formData.nftType === 'ERC1155') {
      const nftIdNum = parseFloat(formData.nftId)
      if (isNaN(nftIdNum) || nftIdNum < 0) {
        errors.nftId = 'NFT ID must be a non-negative number'
      }

      const balanceNum = parseFloat(formData.initialNFTBalance)
      if (isNaN(balanceNum) || balanceNum <= 0) {
        errors.initialNFTBalance = 'Initial NFT balance must be a positive number'
      }
    }

    // ERC20 initial balance validation
    if (formData.paymentToken === 'ERC20') {
      const tokenBalanceNum = parseFloat(formData.initialTokenBalance)
      if (isNaN(tokenBalanceNum) || tokenBalanceNum < 0) {
        errors.initialTokenBalance = 'Initial token balance must be a non-negative number'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Form submitted', { isConnected, formData })
    
    if (!isConnected) {
      setValidationErrors({ submit: 'Please connect your wallet' })
      return
    }

    const isValid = validateForm()
    console.log('Validation result:', isValid, validationErrors)
    
    if (isValid) {
      console.log('Calling onSubmit with:', formData)
      onSubmit(formData)
    } else {
      console.log('Validation failed:', validationErrors)
    }
  }

  const updateField = <K extends keyof CreatePoolFormData>(field: K, value: CreatePoolFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const bondingCurves = BONDING_CURVES[chainId as keyof typeof BONDING_CURVES]
  const hasBondingCurves = !!bondingCurves

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md border border-clay/30 bg-clay/5 p-4">
          <p className="text-clay text-sm">{error}</p>
        </div>
      )}

      {validationErrors.submit && (
        <div className="rounded-md border border-clay/30 bg-clay/5 p-4">
          <p className="text-clay text-sm">{validationErrors.submit}</p>
        </div>
      )}

      {Object.keys(validationErrors).length > 0 && !validationErrors.submit && (
        <div className="rounded-md border border-line bg-mist/60 p-4">
          <p className="text-ink text-sm font-medium mb-2">Please fix the following:</p>
          <ul className="list-disc list-inside space-y-1">
            {Object.entries(validationErrors).map(([field, message]) => (
              <li key={field} className="text-mute text-sm">
                <strong className="text-ink">{field}:</strong> {message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <label className="sm-label">NFT type</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => updateField('nftType', 'ERC721')}
            className={`sm-choice ${formData.nftType === 'ERC721' ? 'sm-choice-active' : ''}`}
          >
            ERC721
          </button>
          <button
            type="button"
            onClick={() => updateField('nftType', 'ERC1155')}
            className={`sm-choice ${formData.nftType === 'ERC1155' ? 'sm-choice-active' : ''}`}
          >
            ERC1155
          </button>
        </div>
      </div>

      <div>
        <label className="sm-label">Payment token</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => updateField('paymentToken', 'ETH')}
            className={`sm-choice ${formData.paymentToken === 'ETH' ? 'sm-choice-active' : ''}`}
          >
            ETH
          </button>
          <button
            type="button"
            onClick={() => updateField('paymentToken', 'ERC20')}
            className={`sm-choice ${formData.paymentToken === 'ERC20' ? 'sm-choice-active' : ''}`}
          >
            ERC20
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="nftContract" className="sm-label">
          NFT contract address *
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            id="nftContract"
            value={formData.nftContract}
            onChange={(e) => updateField('nftContract', e.target.value as Address)}
            placeholder="0x…"
            className={`sm-input font-mono text-xs flex-1 ${
              validationErrors.nftContract ? 'border-clay' : ''
            }`}
          />
          {formData.nftContract && isAddress(formData.nftContract) && userAddress && factoryAddress && (
            <div className="flex items-center shrink-0">
              {isApproved ? (
                <span className="text-sm text-forest px-2">Approved</span>
              ) : (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isApproving || !isConnected}
                  className="sm-btn-secondary"
                >
                  {isApproving ? 'Approving…' : 'Approve'}
                </button>
              )}
            </div>
          )}
        </div>
        {validationErrors.nftContract && (
          <p className="mt-1 text-sm text-clay">{validationErrors.nftContract}</p>
        )}
      </div>

      {formData.paymentToken === 'ERC20' && (
        <div>
          <label htmlFor="erc20Token" className="sm-label">
            ERC20 token address *
          </label>
          <input
            type="text"
            id="erc20Token"
            value={formData.erc20Token || ''}
            onChange={(e) => updateField('erc20Token', e.target.value as Address)}
            placeholder="0x…"
            className={`sm-input font-mono text-xs ${
              validationErrors.erc20Token ? 'border-clay' : ''
            }`}
          />
          {validationErrors.erc20Token && (
            <p className="mt-1 text-sm text-clay">{validationErrors.erc20Token}</p>
          )}
          {erc20Symbol && <p className="mt-1 text-sm text-mute">Token: {erc20Symbol}</p>}
        </div>
      )}

      {hasBondingCurves && (
        <div>
          <label htmlFor="bondingCurve" className="sm-label">
            Bonding curve *
          </label>
          <select
            id="bondingCurve"
            value={formData.bondingCurve}
            onChange={(e) => updateField('bondingCurve', e.target.value as CreatePoolFormData['bondingCurve'])}
            className="sm-input"
          >
            <option value="LINEAR">Linear</option>
            <option value="EXPONENTIAL">Exponential</option>
            <option value="XYK">XYK</option>
            <option value="GDA">GDA</option>
          </select>
        </div>
      )}

      <div>
        <label htmlFor="spotPrice" className="sm-label">
          Spot price ({formData.paymentToken === 'ETH' ? 'ETH' : erc20Symbol || 'Tokens'}) *
        </label>
        <input
          type="number"
          id="spotPrice"
          step="0.0001"
          value={formData.spotPrice}
          onChange={(e) => updateField('spotPrice', e.target.value)}
          placeholder="0.002"
          className={`sm-input ${validationErrors.spotPrice ? 'border-clay' : ''}`}
        />
        {validationErrors.spotPrice && (
          <p className="mt-1 text-sm text-clay">{validationErrors.spotPrice}</p>
        )}
      </div>

      <div>
        <label htmlFor="delta" className="sm-label">
          Delta ({formData.paymentToken === 'ETH' ? 'ETH' : erc20Symbol || 'Tokens'}) *
        </label>
        <input
          type="number"
          id="delta"
          step="0.0001"
          value={formData.delta}
          onChange={(e) => updateField('delta', e.target.value)}
          placeholder="0.01"
          className={`sm-input ${validationErrors.delta ? 'border-clay' : ''}`}
        />
        {validationErrors.delta && (
          <p className="mt-1 text-sm text-clay">{validationErrors.delta}</p>
        )}
        <p className="mt-1 text-xs text-soft">Price adjustment per trade</p>
      </div>

      <div>
        <label htmlFor="fee" className="sm-label">
          Fee (basis points) *
        </label>
        <input
          type="number"
          id="fee"
          step="1"
          value={formData.fee}
          onChange={(e) => updateField('fee', e.target.value)}
          placeholder="100"
          className={`sm-input ${validationErrors.fee ? 'border-clay' : ''}`}
        />
        {validationErrors.fee && (
          <p className="mt-1 text-sm text-clay">{validationErrors.fee}</p>
        )}
        <p className="mt-1 text-xs text-soft">100 = 1%, 1000 = 10%</p>
      </div>

      {formData.nftType === 'ERC721' && (
        <div>
          <label htmlFor="initialNFTIds" className="sm-label">
            Initial NFT IDs (comma-separated) *
          </label>
          <input
            type="text"
            id="initialNFTIds"
            value={formData.initialNFTIds}
            onChange={(e) => updateField('initialNFTIds', e.target.value)}
            placeholder="1, 2, 3"
            className={`sm-input font-mono text-xs ${
              validationErrors.initialNFTIds ? 'border-clay' : ''
            }`}
          />
          {validationErrors.initialNFTIds && (
            <p className="mt-1 text-sm text-clay">{validationErrors.initialNFTIds}</p>
          )}
        </div>
      )}

      {formData.nftType === 'ERC1155' && (
        <>
          <div>
            <label htmlFor="nftId" className="sm-label">
              NFT ID *
            </label>
            <input
              type="number"
              id="nftId"
              value={formData.nftId}
              onChange={(e) => updateField('nftId', e.target.value)}
              placeholder="0"
              className={`sm-input ${validationErrors.nftId ? 'border-clay' : ''}`}
            />
            {validationErrors.nftId && (
              <p className="mt-1 text-sm text-clay">{validationErrors.nftId}</p>
            )}
            {isDebouncing && formData.nftId && (
              <p className="mt-1 text-xs text-soft">Waiting for input…</p>
            )}
          </div>

          {formData.nftId && (loadingTokenInfo || tokenInfo) && (
            <div className="rounded-md border border-line bg-mist/40 p-4">
              {loadingTokenInfo ? (
                <p className="text-sm text-mute">Loading token info…</p>
              ) : tokenInfo ? (
                <div className="space-y-3">
                  {tokenInfo.metadata?.image && (
                    <div className="w-full max-w-xs mx-auto">
                      <img
                        src={tokenInfo.metadata.image}
                        alt={tokenInfo.metadata.name || `Token #${formData.nftId}`}
                        className="w-full h-auto rounded-md border border-line"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                  {tokenInfo.metadata?.name ? (
                    <p className="text-sm font-medium text-ink">{tokenInfo.metadata.name}</p>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-ink">Token ID: #{formData.nftId}</p>
                      <p className="text-xs text-soft mt-1">Metadata not available</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-line">
                    <span className="text-sm text-mute">Your balance</span>
                    <span className="text-sm font-medium text-ink">
                      {tokenInfo.balance.toString()}
                    </span>
                  </div>
                  {tokenInfo.balance === 0n && (
                    <p className="text-xs text-warn bg-mist border border-line rounded-md p-2">
                      You don&apos;t own any of this token. Make sure you have the correct token ID.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-mute">Could not fetch token info.</p>
                  <p className="text-xs text-soft">
                    You can still proceed if you know the token ID is correct.
                  </p>
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="initialNFTBalance" className="sm-label">
              Initial NFT balance *
            </label>
            <input
              type="number"
              id="initialNFTBalance"
              step="1"
              value={formData.initialNFTBalance}
              onChange={(e) => updateField('initialNFTBalance', e.target.value)}
              placeholder={tokenInfo ? tokenInfo.balance.toString() : '10'}
              min="1"
              max={tokenInfo ? tokenInfo.balance.toString() : undefined}
              className={`sm-input ${validationErrors.initialNFTBalance ? 'border-clay' : ''}`}
            />
            {validationErrors.initialNFTBalance && (
              <p className="mt-1 text-sm text-clay">{validationErrors.initialNFTBalance}</p>
            )}
            {tokenInfo && tokenInfo.balance > 0n && (
              <p className="mt-1 text-xs text-soft">
                Maximum: {tokenInfo.balance.toString()} (your balance)
              </p>
            )}
          </div>
        </>
      )}

      {formData.paymentToken === 'ERC20' && (
        <div>
          <label htmlFor="initialTokenBalance" className="sm-label">
            Initial token balance ({erc20Symbol || 'Tokens'})
          </label>
          <input
            type="number"
            id="initialTokenBalance"
            step="0.0001"
            value={formData.initialTokenBalance}
            onChange={(e) => updateField('initialTokenBalance', e.target.value)}
            placeholder="0"
            className={`sm-input ${validationErrors.initialTokenBalance ? 'border-clay' : ''}`}
          />
          {validationErrors.initialTokenBalance && (
            <p className="mt-1 text-sm text-clay">{validationErrors.initialTokenBalance}</p>
          )}
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={isSubmitting || !isConnected}
          className="sm-btn-primary w-full disabled:opacity-40"
        >
          {isSubmitting
            ? 'Creating pool…'
            : isConnected
              ? 'Create pool'
              : 'Connect wallet to continue'}
        </button>
      </div>
    </form>
  )
}
