import { useCartContext } from '@/contexts/CartContext'

/**
 * Hook to access cart functionality
 * Wraps CartContext for easier access
 */
export function useCart() {
  return useCartContext()
}

