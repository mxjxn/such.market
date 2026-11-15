import { ReactNode } from 'react'
import { GildedFrame } from './design/GildedFrame'

interface PageChromeProps {
  children: ReactNode
  title?: string
  subtitle?: string
  className?: string
}

export function PageChrome({ children, title, subtitle, className = '' }: PageChromeProps) {
  return (
    <div className={`min-h-screen bg-velvet-gradient bg-damask ${className}`}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12">
        {(title || subtitle) && (
          <header className="mb-8 text-center">
            {title && (
              <h1 className="font-display text-2xl md:text-4xl uppercase tracking-[0.15em] text-champagne mb-2">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="font-serif text-base italic text-champagne/60 mt-2">{subtitle}</p>
            )}
            <div className="sm-divider mt-6 max-w-md mx-auto" />
          </header>
        )}
        <GildedFrame padding="md">{children}</GildedFrame>
      </div>
    </div>
  )
}
