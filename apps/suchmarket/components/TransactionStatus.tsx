'use client'

import { Hash } from 'viem'

interface TransactionStatusProps {
  status: 'idle' | 'pending' | 'success' | 'error'
  hash?: Hash
  error?: Error | null
}

export function TransactionStatus({ status, hash, error }: TransactionStatusProps) {
  if (status === 'idle') return null

  if (status === 'pending') {
    return (
      <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
          <span className="text-blue-700 font-semibold">Transaction pending...</span>
        </div>
      </div>
    )
  }

  if (status === 'success' && hash) {
    return (
      <div className="border border-green-200 rounded-xl p-4 bg-green-50/50 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center mt-0.5">
            <svg className="w-3 h-3 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-green-800 font-semibold mb-2">Transaction successful!</div>
            <a
              href={`https://basescan.org/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline inline-flex items-center gap-1"
            >
              View on Explorer
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="border border-red-200 rounded-xl p-4 bg-red-50/50 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center mt-0.5">
            <svg className="w-3 h-3 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-red-800 font-semibold mb-1">Transaction failed</div>
            {error && <div className="text-sm text-red-700">{error.message}</div>}
          </div>
        </div>
      </div>
    )
  }

  return null
}

