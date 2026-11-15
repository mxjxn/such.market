import { formatPrice } from '@/lib/pool'
import { CurveError } from '@/lib/contracts'

interface PriceQuoteProps {
  label: string
  totalAmount: bigint
  protocolFee: bigint
  royaltyAmount: bigint
  error?: CurveError
  decimals?: number
}

export function PriceQuote({
  label,
  totalAmount,
  protocolFee,
  royaltyAmount,
  error,
  decimals = 18,
}: PriceQuoteProps) {
  if (error !== undefined && error !== CurveError.OK) {
    return (
      <div className="border rounded-lg p-4 bg-red-50">
        <div className="text-red-600 font-semibold">Error: {CurveError[error]}</div>
      </div>
    )
  }

  const baseAmount = totalAmount - protocolFee - royaltyAmount

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm space-y-2">
      <h3 className="font-semibold text-sm text-gray-900">{label}</h3>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between items-center py-0.5">
          <span className="text-gray-600">Base:</span>
          <span className="font-medium text-gray-900">{formatPrice(baseAmount, decimals)}</span>
        </div>
        <div className="flex justify-between items-center py-0.5">
          <span className="text-gray-600">Protocol Fee:</span>
          <span className="font-medium text-gray-700">{formatPrice(protocolFee, decimals)}</span>
        </div>
        <div className="flex justify-between items-center py-0.5">
          <span className="text-gray-600">Royalty:</span>
          <span className="font-medium text-gray-700">{formatPrice(royaltyAmount, decimals)}</span>
        </div>
        <div className="flex justify-between items-center font-semibold border-t border-gray-200 pt-2 mt-1">
          <span className="text-gray-900 text-sm">Total:</span>
          <span className="text-gray-900 text-sm">{formatPrice(totalAmount, decimals)}</span>
        </div>
      </div>
    </div>
  )
}

