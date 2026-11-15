'use client'

import { useState, useEffect } from 'react'

interface QuantitySelectorProps {
  value: number
  onChange: (quantity: number) => void
  max: number
  min?: number
  showPrice?: boolean
  pricePerItem?: bigint
  decimals?: number
}

export function QuantitySelector({
  value,
  onChange,
  max,
  min = 1,
  showPrice = false,
  pricePerItem,
  decimals = 18,
}: QuantitySelectorProps) {
  const [inputValue, setInputValue] = useState(value.toString())

  useEffect(() => {
    setInputValue(value.toString())
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    
    const numValue = parseInt(newValue, 10)
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(min, Math.min(max, numValue))
      onChange(clampedValue)
    } else if (newValue === '') {
      // Allow empty input temporarily
      setInputValue('')
    }
  }

  const handleInputBlur = () => {
    const numValue = parseInt(inputValue, 10)
    if (isNaN(numValue) || numValue < min) {
      setInputValue(min.toString())
      onChange(min)
    } else if (numValue > max) {
      setInputValue(max.toString())
      onChange(max)
    } else {
      setInputValue(numValue.toString())
      onChange(numValue)
    }
  }

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10)
    setInputValue(newValue.toString())
    onChange(newValue)
  }

  const increment = () => {
    const newValue = Math.min(max, value + 1)
    onChange(newValue)
  }

  const decrement = () => {
    const newValue = Math.max(min, value - 1)
    onChange(newValue)
  }

  const formatPrice = (amount: bigint, decimals: number): string => {
    const divisor = BigInt(10 ** decimals)
    const whole = amount / divisor
    const remainder = amount % divisor
    if (remainder === 0n) {
      return whole.toString()
    }
    const decimalsStr = remainder.toString().padStart(decimals, '0')
    const trimmed = decimalsStr.replace(/0+$/, '')
    return `${whole}.${trimmed}`
  }

  const totalPrice = pricePerItem ? pricePerItem * BigInt(value) : 0n

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={decrement}
          disabled={value <= min}
          className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-semibold text-gray-700"
        >
          −
        </button>
        <input
          type="number"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          min={min}
          max={max}
          className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
        <button
          type="button"
          onClick={increment}
          disabled={value >= max}
          className="w-8 h-8 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-semibold text-gray-700"
        >
          +
        </button>
        <span className="text-sm text-gray-600 ml-2">
          / {max} available
        </span>
      </div>

      <div className="space-y-1">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={handleSliderChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>

      {showPrice && pricePerItem !== undefined && pricePerItem > 0n && (
        <div className="pt-2 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Price per item:</span>
            <span className="text-sm font-semibold text-gray-900">
              {formatPrice(pricePerItem, decimals)} ETH
            </span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-sm font-semibold text-gray-900">Total:</span>
            <span className="text-lg font-bold text-blue-600">
              {formatPrice(totalPrice, decimals)} ETH
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

