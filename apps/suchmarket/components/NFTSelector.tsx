'use client'

import { useState } from 'react'
import { Address } from 'viem'

interface NFTSelectorProps {
  nftIds: bigint[]
  selectedIds: bigint[]
  onSelectionChange: (ids: bigint[]) => void
  disabled?: boolean
}

export function NFTSelector({ nftIds, selectedIds, onSelectionChange, disabled }: NFTSelectorProps) {
  const toggleSelection = (id: bigint) => {
    if (disabled) return
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id))
    } else {
      onSelectionChange([...selectedIds, id])
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm space-y-2">
      <h3 className="font-semibold text-sm text-gray-900">Select NFTs</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-2">
        {nftIds.map((id) => {
          const isSelected = selectedIds.includes(id)
          return (
            <button
              key={id.toString()}
              onClick={() => toggleSelection(id)}
              disabled={disabled}
              className={`p-2 border-2 rounded text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white hover:bg-gray-50 border-gray-300 text-gray-900 hover:border-gray-400'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
            >
              #{id.toString()}
            </button>
          )
        })}
      </div>
      {nftIds.length === 0 && (
        <p className="text-gray-500 text-xs text-center py-1">No NFTs available. Enter NFT IDs manually.</p>
      )}
    </div>
  )
}

interface ManualNFTInputProps {
  onIdsChange: (ids: bigint[]) => void
}

export function ManualNFTInput({ onIdsChange }: ManualNFTInputProps) {
  const [input, setInput] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInput(value)
    
    // Parse comma-separated IDs
    const ids = value
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id !== '')
      .map((id) => {
        try {
          return BigInt(id)
        } catch {
          return null
        }
      })
      .filter((id): id is bigint => id !== null)
    
    onIdsChange(ids)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
      <label className="block text-xs font-semibold text-gray-900 mb-2">
        Enter NFT IDs (comma-separated):
      </label>
      <input
        type="text"
        value={input}
        onChange={handleChange}
        placeholder="1, 2, 3"
        className="w-full px-3 py-2 border border-gray-300 rounded bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors text-sm text-gray-900 placeholder-gray-400"
      />
      <p className="mt-1 text-xs text-gray-500">Separate multiple IDs with commas</p>
    </div>
  )
}

