'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function WalletButton({ onBrand = false }: { onBrand?: boolean }) {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  const connectedClass = onBrand
    ? 'sm-btn-on-brand-ghost font-mono text-sm'
    : 'sm-btn-secondary font-mono text-xs'
  const connectClass = onBrand ? 'sm-btn-on-brand' : 'sm-btn-primary'

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        className={connectedClass}
        title="Disconnect"
      >
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    )
  }

  const injected = connectors.find((c) => c.id === 'injected') || connectors[0]

  return (
    <button
      type="button"
      disabled={isPending || !injected}
      onClick={() => injected && connect({ connector: injected })}
      className={connectClass}
    >
      {isPending ? 'Connecting…' : 'Connect wallet'}
    </button>
  )
}
