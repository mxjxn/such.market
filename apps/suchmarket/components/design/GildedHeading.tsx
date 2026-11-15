import { ReactNode } from 'react'

interface GildedHeadingProps {
  children: ReactNode
  subtitle?: string
  as?: 'h1' | 'h2' | 'h3'
  className?: string
}

export function GildedHeading({
  children,
  subtitle,
  as: Tag = 'h1',
  className = '',
}: GildedHeadingProps) {
  return (
    <header className={`text-center ${className}`}>
      <div className="sm-flourish-line mb-4 font-accent text-gold text-lg" aria-hidden>
        ✦
      </div>
      <Tag className="sm-page-title">{children}</Tag>
      {subtitle && <p className="sm-page-subtitle mt-4 max-w-2xl mx-auto">{subtitle}</p>}
      <div className="sm-divider mt-6 max-w-xs mx-auto" />
    </header>
  )
}
