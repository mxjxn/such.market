'use client'

import { useState } from 'react'
import { useCart } from '@/hooks/useCart'
import { Address } from 'viem'
import { CheckoutDialog } from './CheckoutDialog'

interface CartProps {
  poolAddress?: Address
  chainId?: number
  isERC1155?: boolean
  poolNftId?: bigint
}

export function Cart({ poolAddress, chainId, isERC1155, poolNftId }: CartProps) {
  const { items, removeFromCart, updateQuantity, getTotalItems } = useCart()
  const [isOpen, setIsOpen] = useState(false)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)

  // Filter cart items for current pool
  const poolItems = items.filter(item =>
    poolAddress && chainId &&
    item.poolAddress.toLowerCase() === poolAddress.toLowerCase() &&
    item.chainId === chainId
  )

  const handleCheckout = () => {
    if (poolItems.length === 0) return
    setIsOpen(false)
    setIsCheckoutOpen(true)
  }

  const handleCheckoutSuccess = () => {
    // Remove purchased items from cart
    poolItems.forEach(item => {
      removeFromCart(item.poolAddress, item.nftId)
    })
  }

  const totalItems = getTotalItems()
  const poolTotalItems = poolItems.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <>
      {/* Floating Cart Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-green-500 text-white rounded-full p-4 shadow-lg hover:bg-green-600 transition-colors flex items-center justify-center"
        aria-label="Open cart"
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
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        {totalItems > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {totalItems}
          </span>
        )}
      </button>

      {/* Drawer Overlay */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={`fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
              isOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Cart ({items.length} {items.length === 1 ? 'item' : 'items'})</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                  aria-label="Close cart"
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
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <svg
                      className="w-16 h-16 mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                    <p className="text-lg font-semibold">Your cart is empty</p>
                    <p className="text-sm">Add NFTs to your cart to get started</p>
                  </div>
                ) : (
                  <>
                    {poolItems.length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2">Current Pool Items ({poolTotalItems})</h3>
                        {poolItems.map((item, index) => (
                          <div
                            key={`${item.poolAddress}-${item.nftId}-${index}`}
                            className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-2"
                          >
                            <div className="flex gap-4">
                              {/* NFT Image */}
                              <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                                {item.metadata?.image ? (
                                  <img
                                    src={item.metadata.image}
                                    alt={item.metadata.name || `NFT #${item.nftId.toString()}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <svg
                                      className="w-8 h-8"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                      />
                                    </svg>
                                  </div>
                                )}
                              </div>

                              {/* NFT Details */}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 truncate">
                                  {item.metadata?.name || `NFT #${item.nftId.toString()}`}
                                </h3>
                                <p className="text-xs text-gray-500 font-mono mt-1">
                                  #{item.nftId.toString()}
                                </p>
                                {item.isERC1155 && (
                                  <div className="mt-2">
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs text-gray-600">Quantity:</label>
                                      <input
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) => {
                                          const newQuantity = parseInt(e.target.value, 10)
                                          if (!isNaN(newQuantity) && newQuantity > 0) {
                                            updateQuantity(item.poolAddress, item.nftId, newQuantity)
                                          }
                                        }}
                                        className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                      />
                                    </div>
                                  </div>
                                )}
                                {!item.isERC1155 && (
                                  <p className="text-xs text-gray-500 mt-1">Quantity: 1</p>
                                )}
                              </div>

                              {/* Remove Button */}
                              <button
                                onClick={() => removeFromCart(item.poolAddress, item.nftId)}
                                className="text-red-500 hover:text-red-700 flex-shrink-0"
                                aria-label="Remove from cart"
                              >
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {items.filter(item => !poolItems.includes(item)).length > 0 && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          You have items from other pools in your cart. Checkout is only available for items from the current pool.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer with Checkout */}
              {poolItems.length > 0 && (
                <div className="border-t border-gray-200 p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900">Total Items:</span>
                    <span className="text-lg font-bold text-gray-900">{poolTotalItems}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        poolItems.forEach(item => removeFromCart(item.poolAddress, item.nftId))
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold transition-colors"
                    >
                      Clear Pool Items
                    </button>
                    <button
                      onClick={handleCheckout}
                      disabled={poolItems.length === 0}
                      className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Checkout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Checkout Dialog */}
      {poolAddress && chainId !== undefined && (
        <CheckoutDialog
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          items={poolItems}
          poolAddress={poolAddress}
          chainId={chainId}
          isERC1155={isERC1155}
          poolNftId={poolNftId}
          onSuccess={handleCheckoutSuccess}
        />
      )}
    </>
  )
}
