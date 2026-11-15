'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Address } from 'viem'
import { NFTMetadata } from '@/lib/metadata'

export interface CartItem {
  poolAddress: Address
  chainId: number
  nftId: bigint
  quantity: number
  isERC1155: boolean
  metadata?: NFTMetadata | null
  // For ERC721: quantity is always 1, nftId is the tokenId
  // For ERC1155: quantity can be > 1, nftId is the pool's nftId
}

interface CartContextType {
  items: CartItem[]
  addToCart: (item: CartItem) => void
  removeFromCart: (poolAddress: Address, nftId: bigint) => void
  updateQuantity: (poolAddress: Address, nftId: bigint, quantity: number) => void
  clearCart: () => void
  getItemCount: () => number
  getTotalItems: () => number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const CART_STORAGE_KEY = 'nft-lp-cart'
const CART_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

interface CartStorage {
  items: CartItem[]
  timestamp: number
}

function serializeCartItem(item: CartItem): any {
  return {
    ...item,
    nftId: item.nftId.toString(),
  }
}

function deserializeCartItem(item: any): CartItem {
  return {
    ...item,
    nftId: BigInt(item.nftId),
  }
}

function loadCartFromStorage(): CartItem[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY)
    if (!stored) return []
    
    const parsed: CartStorage = JSON.parse(stored)
    
    // Check if cart has expired
    if (Date.now() - parsed.timestamp > CART_EXPIRY_MS) {
      localStorage.removeItem(CART_STORAGE_KEY)
      return []
    }
    
    return parsed.items.map(deserializeCartItem)
  } catch (error) {
    console.error('Error loading cart from storage:', error)
    return []
  }
}

function saveCartToStorage(items: CartItem[]) {
  if (typeof window === 'undefined') return
  
  try {
    const storage: CartStorage = {
      items: items.map(serializeCartItem),
      timestamp: Date.now(),
    }
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(storage))
  } catch (error) {
    console.error('Error saving cart to storage:', error)
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  // Load cart from localStorage on mount
  useEffect(() => {
    const loadedItems = loadCartFromStorage()
    setItems(loadedItems)
  }, [])

  // Save cart to localStorage whenever items change
  useEffect(() => {
    saveCartToStorage(items)
  }, [items])

  const addToCart = (item: CartItem) => {
    setItems((prevItems) => {
      // Check if item already exists (same pool + nftId)
      const existingIndex = prevItems.findIndex(
        (i) => i.poolAddress.toLowerCase() === item.poolAddress.toLowerCase() && 
               i.nftId === item.nftId &&
               i.chainId === item.chainId
      )

      if (existingIndex >= 0) {
        // Update quantity if it exists
        const updated = [...prevItems]
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: updated[existingIndex].quantity + item.quantity,
          metadata: item.metadata ?? updated[existingIndex].metadata,
        }
        return updated
      } else {
        // Add new item
        return [...prevItems, item]
      }
    })
  }

  const removeFromCart = (poolAddress: Address, nftId: bigint) => {
    setItems((prevItems) =>
      prevItems.filter(
        (item) =>
          item.poolAddress.toLowerCase() !== poolAddress.toLowerCase() ||
          item.nftId !== nftId
      )
    )
  }

  const updateQuantity = (poolAddress: Address, nftId: bigint, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(poolAddress, nftId)
      return
    }

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.poolAddress.toLowerCase() === poolAddress.toLowerCase() &&
        item.nftId === nftId
          ? { ...item, quantity }
          : item
      )
    )
  }

  const clearCart = () => {
    setItems([])
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CART_STORAGE_KEY)
    }
  }

  const getItemCount = () => items.length

  const getTotalItems = () => items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getItemCount,
        getTotalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCartContext() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCartContext must be used within a CartProvider')
  }
  return context
}

