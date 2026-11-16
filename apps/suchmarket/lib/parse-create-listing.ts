import { Address, decodeEventLog, Log, parseAbiItem } from 'viem'
import { getMarketplaceAddress } from './marketplace'

const CREATE_LISTING = parseAbiItem(
  'event CreateListing(uint40 indexed listingId, uint16 marketplaceBPS, uint16 referrerBPS, uint8 listingType, uint24 totalAvailable, uint24 totalPerSale, uint48 startTime, uint48 endTime, uint256 initialAmount, uint16 extensionInterval, uint16 minIncrementBPS, address erc20, address identityVerifier)'
)

export function parseListingIdFromLogs(chainId: number, logs: Log[]): bigint | null {
  let marketplace: Address
  try {
    marketplace = getMarketplaceAddress(chainId)
  } catch {
    return null
  }

  const marketplaceLower = marketplace.toLowerCase()

  for (const log of logs) {
    if (log.address.toLowerCase() !== marketplaceLower) continue
    try {
      const decoded = decodeEventLog({
        abi: [CREATE_LISTING],
        data: log.data,
        topics: log.topics,
      })
      if (decoded.eventName !== 'CreateListing') continue
      const listingId = decoded.args.listingId
      return typeof listingId === 'bigint' ? listingId : BigInt(listingId)
    } catch {
      /* next log */
    }
  }
  return null
}

export function parseListingIdFromReceipt(
  chainId: number,
  receipt: { logs: Log[] } | null | undefined
): bigint | null {
  if (!receipt?.logs?.length) return null
  return parseListingIdFromLogs(chainId, receipt.logs)
}