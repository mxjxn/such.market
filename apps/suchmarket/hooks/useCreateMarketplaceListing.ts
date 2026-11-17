'use client'

import { useCallback, useEffect, useState } from 'react'
import { Address } from 'viem'
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { MARKETPLACE_ABI, getMarketplaceAddress } from '@/lib/marketplace'
import { encodeCreateListingArgs, type SellListingForm } from '@/lib/sell-listing'
import { parseListingIdFromReceipt } from '@/lib/parse-create-listing'

export function useCreateMarketplaceListing(chainId: number) {
  const { address } = useAccount()
  const [listingId, setListingId] = useState<bigint | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    writeContract,
    data: txHash,
    isPending: isSubmitting,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash: txHash })

  const createListing = useCallback(
    (form: SellListingForm) => {
      setSubmitError(null)
      setListingId(null)
      resetWrite()

      if (!address) {
        setSubmitError('Connect your wallet to continue')
        return
      }

      let args: ReturnType<typeof encodeCreateListingArgs>
      try {
        args = encodeCreateListingArgs(form)
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Invalid listing parameters')
        return
      }

      let marketplace: Address
      try {
        marketplace = getMarketplaceAddress(chainId)
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Marketplace not configured')
        return
      }

      writeContract({
        address: marketplace,
        abi: MARKETPLACE_ABI,
        functionName: 'createListing',
        chainId,
        args: [
          args.listingDetails,
          args.tokenDetails,
          args.deliveryFees,
          args.listingReceivers,
          args.enableReferrer,
          args.acceptOffers,
          args.data,
        ],
      })
    },
    [address, chainId, resetWrite, writeContract]
  )

  useEffect(() => {
    if (isSuccess && receipt && listingId === null) {
      const parsed = parseListingIdFromReceipt(chainId, receipt)
      if (parsed !== null) setListingId(parsed)
    }
  }, [chainId, isSuccess, listingId, receipt])

  const error =
    submitError ||
    (writeError ? writeError.message : null) ||
    (receiptError ? receiptError.message : null)

  return {
    createListing,
    txHash,
    listingId,
    isSubmitting,
    isConfirming,
    isSuccess,
    error,
    reset: () => {
      setListingId(null)
      setSubmitError(null)
      resetWrite()
    },
  }
}