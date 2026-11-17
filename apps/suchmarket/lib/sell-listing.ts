import { Address, isAddress, parseUnits, zeroAddress } from 'viem'
import { ListingType } from './marketplace'

export const TokenSpec = {
  ERC721: 1,
  ERC1155: 2,
} as const

export type SellListingKind = 'auction' | 'fixed_price'

export type SellTimingMode = 'now' | 'scheduled' | 'on_first_bid'

export type SellListingForm = {
  kind: SellListingKind
  /** Reserve / ask price in display units (ETH or ERC-20 decimals). */
  price: string
  paymentToken: 'ETH' | 'ERC20'
  erc20Address?: string
  erc20Decimals?: number
  timingMode: SellTimingMode
  /** Auction duration in seconds when timingMode is `now` or `on_first_bid`. */
  durationSeconds: number
  /** Unix seconds — used when timingMode is `scheduled`. */
  scheduledStartSec?: number
  scheduledEndSec?: number
  minIncrementBps: number
  totalAvailable: number
  totalPerSale: number
  tokenId: string
  tokenStandard: 'ERC721' | 'ERC1155'
  nftContract: string
  extensionIntervalSeconds?: number
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; field: string; message: string }

const MAX_REASONABLE_SECONDS = 6 * 30 * 24 * 60 * 60 // ~6 months
const DEFAULT_MIN_INCREMENT_BPS = 500

export function validateSellListingForm(form: SellListingForm, nowSec = Math.floor(Date.now() / 1000)): ValidationResult {
  if (!form.nftContract || !isAddress(form.nftContract)) {
    return { ok: false, field: 'nftContract', message: 'Enter a valid NFT contract address' }
  }

  let tokenId: bigint
  try {
    tokenId = BigInt(form.tokenId.trim())
    if (tokenId < 0n) throw new Error('negative')
  } catch {
    return { ok: false, field: 'tokenId', message: 'Enter a valid token ID' }
  }
  void tokenId

  if (!form.price.trim() || Number.isNaN(Number(form.price)) || Number(form.price) <= 0) {
    return { ok: false, field: 'price', message: 'Price must be greater than zero' }
  }

  if (form.paymentToken === 'ERC20') {
    if (!form.erc20Address || !isAddress(form.erc20Address)) {
      return { ok: false, field: 'erc20Address', message: 'ERC-20 payment requires a valid token address' }
    }
    if (form.erc20Decimals === undefined || form.erc20Decimals < 0 || form.erc20Decimals > 36) {
      return { ok: false, field: 'erc20Decimals', message: 'ERC-20 decimals are required' }
    }
  }

  if (form.kind === 'auction') {
    if (form.timingMode === 'scheduled') {
      const start = form.scheduledStartSec ?? 0
      const end = form.scheduledEndSec ?? 0
      if (end <= start) {
        return { ok: false, field: 'scheduledEndSec', message: 'Auction end must be after start' }
      }
      if (end <= nowSec) {
        return { ok: false, field: 'scheduledEndSec', message: 'Auction end must be in the future' }
      }
      if (end > nowSec + MAX_REASONABLE_SECONDS) {
        return { ok: false, field: 'scheduledEndSec', message: 'Auction end cannot be more than 6 months out' }
      }
    } else {
      if (form.durationSeconds <= 0) {
        return { ok: false, field: 'durationSeconds', message: 'Auction duration must be positive' }
      }
      if (form.durationSeconds > MAX_REASONABLE_SECONDS) {
        return { ok: false, field: 'durationSeconds', message: 'Auction duration cannot exceed 6 months' }
      }
    }

    const minBps = form.minIncrementBps ?? DEFAULT_MIN_INCREMENT_BPS
    if (minBps < 0 || minBps > 10_000) {
      return { ok: false, field: 'minIncrementBps', message: 'Min bid increment must be between 0 and 10000 bps' }
    }
  }

  if (form.kind === 'fixed_price') {
    if (form.totalAvailable < 1 || form.totalPerSale < 1) {
      return { ok: false, field: 'totalAvailable', message: 'Quantity must be at least 1' }
    }
    if (form.totalPerSale > form.totalAvailable) {
      return { ok: false, field: 'totalPerSale', message: 'Per-sale quantity cannot exceed total available' }
    }
    if (form.tokenStandard === 'ERC721' && (form.totalAvailable !== 1 || form.totalPerSale !== 1)) {
      return {
        ok: false,
        field: 'totalAvailable',
        message: 'ERC-721 fixed-price listings must sell one token at a time',
      }
    }
  }

  return { ok: true }
}

export type EncodedCreateListingArgs = {
  listingDetails: {
    initialAmount: bigint
    type_: number
    totalAvailable: number
    totalPerSale: number
    extensionInterval: number
    minIncrementBPS: number
    erc20: Address
    identityVerifier: Address
    startTime: number
    endTime: number
  }
  tokenDetails: {
    id: bigint
    address_: Address
    spec: number
    lazy: boolean
  }
  deliveryFees: { deliverBPS: number; deliverFixed: bigint }
  listingReceivers: []
  enableReferrer: boolean
  acceptOffers: boolean
  data: `0x${string}`
}

export function encodeCreateListingArgs(form: SellListingForm, nowSec = Math.floor(Date.now() / 1000)): EncodedCreateListingArgs {
  const validation = validateSellListingForm(form, nowSec)
  if (!validation.ok) {
    throw new Error(validation.message)
  }

  const decimals =
    form.paymentToken === 'ETH' ? 18 : (form.erc20Decimals as number)

  const initialAmount = parseUnits(form.price.trim(), decimals)
  const erc20: Address =
    form.paymentToken === 'ERC20' && form.erc20Address
      ? (form.erc20Address as Address)
      : zeroAddress

  const { startTime, endTime } = resolveListingTimes(form, nowSec)

  let type_: number
  let totalAvailable: number
  let totalPerSale: number
  let minIncrementBPS: number
  let extensionInterval = form.extensionIntervalSeconds ?? 0

  if (form.kind === 'auction') {
    type_ = ListingType.INDIVIDUAL_AUCTION
    totalAvailable = 1
    totalPerSale = 1
    minIncrementBPS = form.minIncrementBps ?? DEFAULT_MIN_INCREMENT_BPS
  } else {
    type_ = ListingType.FIXED_PRICE
    totalAvailable = form.totalAvailable
    totalPerSale = form.totalPerSale
    minIncrementBPS = 0
    extensionInterval = 0
  }

  const spec = form.tokenStandard === 'ERC1155' ? TokenSpec.ERC1155 : TokenSpec.ERC721

  return {
    listingDetails: {
      initialAmount,
      type_,
      totalAvailable,
      totalPerSale,
      extensionInterval,
      minIncrementBPS,
      erc20,
      identityVerifier: zeroAddress,
      startTime,
      endTime,
    },
    tokenDetails: {
      id: BigInt(form.tokenId.trim()),
      address_: form.nftContract as Address,
      spec,
      lazy: false,
    },
    deliveryFees: { deliverBPS: 0, deliverFixed: 0n },
    listingReceivers: [],
    enableReferrer: false,
    acceptOffers: false,
    data: '0x',
  }
}

export function resolveListingTimes(
  form: SellListingForm,
  nowSec: number
): { startTime: number; endTime: number } {
  if (form.kind === 'fixed_price') {
    return { startTime: 0, endTime: 0 }
  }

  if (form.timingMode === 'scheduled') {
    return {
      startTime: form.scheduledStartSec ?? nowSec,
      endTime: form.scheduledEndSec ?? nowSec + form.durationSeconds,
    }
  }

  if (form.timingMode === 'on_first_bid') {
    return { startTime: 0, endTime: form.durationSeconds }
  }

  return { startTime: nowSec, endTime: nowSec + form.durationSeconds }
}