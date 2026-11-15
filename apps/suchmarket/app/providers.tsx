'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { base, baseSepolia, mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { useState, useEffect } from 'react'
import { farcasterFrame } from '@farcaster/miniapp-wagmi-connector'
import { CartProvider } from '@/contexts/CartContext'
import { CONFIG } from '@/lib/config'
import { ChainProvider } from '@/contexts/ChainContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: 1,
    },
  },
})

export const config = createConfig({
  chains: [base, baseSepolia, mainnet],
  transports: {
    [base.id]: http(CONFIG.BASE_RPC_URL),
    [baseSepolia.id]: http(CONFIG.BASE_SEPOLIA_RPC_URL),
    [mainnet.id]: http(CONFIG.ETHEREUM_RPC_URL),
  },
  connectors: [injected({ shimDisconnect: true }), farcasterFrame()],
})

export function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk')
        await sdk.actions.ready()
      } catch {
        // Browser / non-miniapp context is fine
      } finally {
        setReady(true)
      }
    }
    if (typeof window !== 'undefined') init()
    else setReady(true)
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper text-mute text-sm">
        Loading Suchmarket…
      </div>
    )
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ChainProvider>
          <CartProvider>{children}</CartProvider>
        </ChainProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
