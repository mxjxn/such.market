import { useState, useEffect } from 'react'

/**
 * Hook to detect if we're running in a Farcaster mini-app context
 */
export function useIsMiniapp() {
  const [isMiniapp, setIsMiniapp] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if we're in a Farcaster mini-app by checking for the SDK
    const checkMiniapp = async () => {
      try {
        // Check if Farcaster miniapp SDK is available
        const { sdk } = await import('@farcaster/miniapp-sdk')
        // Check if SDK has context (indicates we're in a mini-app)
        const context = await sdk.context
        setIsMiniapp(!!context)
      } catch (error) {
        // Not in miniapp context - check if we're in an iframe (common for mini-apps)
        const isInIframe = window.self !== window.top
        setIsMiniapp(isInIframe)
      }
    }

    checkMiniapp()
  }, [])

  return isMiniapp
}

