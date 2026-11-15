import { ReactNode } from 'react'
import { GildedFrame } from './GildedFrame'

interface StatusPanelProps {
  children: ReactNode
  variant?: 'default' | 'error' | 'loading'
}

export function StatusPanel({ children, variant = 'default' }: StatusPanelProps) {
  const variantClass =
    variant === 'error'
      ? 'border-crimson/40'
      : variant === 'loading'
        ? 'border-gold/30'
        : 'border-gold/20'

  return (
    <GildedFrame padding="lg" className={`text-center ${variantClass}`}>
      {children}
    </GildedFrame>
  )
}

export function LoadingSpinner({ label = 'Consulting the archives…' }: { label?: string }) {
  return (
    <StatusPanel variant="loading">
      <div
        className="w-14 h-14 mx-auto mb-6 border-2 border-gold/30 border-t-gold rounded-full animate-spin"
        aria-hidden
      />
      <p className="font-serif text-lg italic text-champagne/70">{label}</p>
    </StatusPanel>
  )
}

export function ErrorPanel({ title, message }: { title: string; message: string }) {
  return (
    <StatusPanel variant="error">
      <p className="font-display text-sm uppercase tracking-[0.15em] text-crimson mb-2">{title}</p>
      <p className="font-serif text-sm text-champagne/60">{message}</p>
    </StatusPanel>
  )
}
