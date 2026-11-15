'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useChainId, useSwitchChain } from 'wagmi'
import { base } from 'viem/chains'
import { DEFAULT_CHAIN_ID, SupportedChainId, isSupportedChainId } from '@/lib/chains'

interface ChainContextValue {
  chainId: SupportedChainId
  setChainId: (id: SupportedChainId) => void
}

const ChainContext = createContext<ChainContextValue | null>(null)

export function ChainProvider({ children }: { children: ReactNode }) {
  const walletChainId = useChainId()
  const { switchChain } = useSwitchChain()
  const [chainId, setChainIdState] = useState<SupportedChainId>(DEFAULT_CHAIN_ID)

  useEffect(() => {
    if (isSupportedChainId(walletChainId)) {
      setChainIdState(walletChainId)
    }
  }, [walletChainId])

  const setChainId = (id: SupportedChainId) => {
    setChainIdState(id)
    try {
      switchChain?.({ chainId: id })
    } catch {
      // Wallet may not be connected
    }
  }

  return (
    <ChainContext.Provider value={{ chainId, setChainId }}>{children}</ChainContext.Provider>
  )
}

export function useAppChain() {
  const ctx = useContext(ChainContext)
  if (!ctx) {
    return {
      chainId: base.id as SupportedChainId,
      setChainId: (_id: SupportedChainId) => {},
    }
  }
  return ctx
}
