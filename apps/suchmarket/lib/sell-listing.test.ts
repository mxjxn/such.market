import { describe, expect, it } from 'vitest'
import { ListingType } from './marketplace'
import {
  encodeCreateListingArgs,
  resolveListingTimes,
  validateSellListingForm,
  type SellListingForm,
} from './sell-listing'

const baseForm: SellListingForm = {
  kind: 'auction',
  price: '0.1',
  paymentToken: 'ETH',
  timingMode: 'now',
  durationSeconds: 86_400,
  minIncrementBps: 500,
  totalAvailable: 1,
  totalPerSale: 1,
  tokenId: '42',
  tokenStandard: 'ERC721',
  nftContract: '0x0000000000000000000000000000000000000001',
}

describe('validateSellListingForm', () => {
  it('rejects invalid contract', () => {
    const r = validateSellListingForm({ ...baseForm, nftContract: 'not-an-address' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.field).toBe('nftContract')
  })

  it('rejects ERC721 fixed price with quantity > 1', () => {
    const r = validateSellListingForm({
      ...baseForm,
      kind: 'fixed_price',
      totalAvailable: 5,
      totalPerSale: 1,
    })
    expect(r.ok).toBe(false)
  })

  it('accepts ERC1155 fixed price with quantity', () => {
    const r = validateSellListingForm({
      ...baseForm,
      kind: 'fixed_price',
      tokenStandard: 'ERC1155',
      totalAvailable: 10,
      totalPerSale: 2,
    })
    expect(r.ok).toBe(true)
  })
})

describe('encodeCreateListingArgs', () => {
  it('encodes English auction with reserve', () => {
    const now = 1_700_000_000
    const encoded = encodeCreateListingArgs({ ...baseForm, price: '1.5' }, now)
    expect(encoded.listingDetails.type_).toBe(ListingType.INDIVIDUAL_AUCTION)
    expect(encoded.listingDetails.initialAmount).toBe(1_500_000_000_000_000_000n)
    expect(encoded.listingDetails.startTime).toBe(now)
    expect(encoded.listingDetails.endTime).toBe(now + 86_400)
    expect(encoded.tokenDetails.id).toBe(42n)
    expect(encoded.tokenDetails.spec).toBe(1)
  })

  it('encodes fixed-price 1155 listing', () => {
    const encoded = encodeCreateListingArgs({
      ...baseForm,
      kind: 'fixed_price',
      tokenStandard: 'ERC1155',
      totalAvailable: 8,
      totalPerSale: 2,
      price: '0.05',
    })
    expect(encoded.listingDetails.type_).toBe(ListingType.FIXED_PRICE)
    expect(encoded.listingDetails.totalAvailable).toBe(8)
    expect(encoded.listingDetails.minIncrementBPS).toBe(0)
    expect(encoded.tokenDetails.spec).toBe(2)
  })
})

describe('resolveListingTimes', () => {
  it('uses duration as endTime when start on first bid', () => {
    const t = resolveListingTimes(
      { ...baseForm, timingMode: 'on_first_bid', durationSeconds: 604_800 },
      100
    )
    expect(t).toEqual({ startTime: 0, endTime: 604_800 })
  })
})