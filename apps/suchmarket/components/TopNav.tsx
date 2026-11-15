'use client'

import { usePathname, useRouter } from 'next/navigation'

export function TopNav() {
  const pathname = usePathname()
  const router = useRouter()

  const getBackDestination = () => {
    if (pathname.startsWith('/pool/')) {
      return '/'
    }
    if (pathname.startsWith('/browse/') || pathname.startsWith('/pools/') || pathname.startsWith('/create')) {
      return '/'
    }
    return null
  }

  const backDestination = getBackDestination()

  if (!backDestination) {
    return null
  }

  return (
    <nav className="border-b border-gold/15 bg-velvet/80 backdrop-blur-sm sticky top-[73px] z-40">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <button
          onClick={() => router.push(backDestination)}
          className="font-display text-xs uppercase tracking-[0.2em] text-gold/90 hover:text-gold flex items-center gap-2 transition-colors"
        >
          <span className="text-base" aria-hidden>
            ‹
          </span>
          <span>Return to Salon</span>
        </button>
      </div>
    </nav>
  )
}
