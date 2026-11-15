'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getEnabledChainIds, getChainName, type SupportedChainId } from '@/lib/chains'
import { WalletButton } from './WalletButton'
import { useAppChain } from '@/contexts/ChainContext'

const NAV: { href: string; label: string; soon?: boolean }[] = [
  { href: '/explore', label: 'Explore' },
  { href: '/create', label: 'Create pool' },
  { href: '/my-pools', label: 'My pools' },
  { href: '/auctions', label: 'Auctions' },
]

export function SiteHeader() {
  const pathname = usePathname()
  const { chainId, setChainId } = useAppChain()

  if (pathname?.startsWith('/embed')) {
    return null
  }

  return (
    <header className="sm-header-bar sticky top-0 z-40 shadow-md">
      <div className="sm-container flex min-h-[4.5rem] md:min-h-[5rem] items-center justify-between gap-4 py-3 md:py-4">
        <div className="flex items-center gap-6 md:gap-10 min-w-0">
          <Link href="/" className="shrink-0">
            <span className="sm-wordmark text-[1.65rem] md:text-[1.85rem] leading-none text-white drop-shadow-sm">
              such.market
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1.5" aria-label="Primary">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl px-3.5 py-2 text-base transition ${
                    active
                      ? 'bg-white text-orange-deep font-semibold shadow-sm'
                      : 'text-white/95 hover:bg-white/15 hover:text-white'
                  }`}
                >
                  {item.label}
                  {item.soon && (
                    <span
                      className={`ml-1.5 sm-play text-[11px] uppercase tracking-wider ${
                        active ? 'text-sky-deep' : 'text-white/80'
                      }`}
                    >
                      Soon
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex rounded-xl border-2 border-white/40 bg-black/15 p-1 max-w-[220px] overflow-x-auto">
            {getEnabledChainIds().map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setChainId(id as SupportedChainId)}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  chainId === id
                    ? 'bg-white text-sky-deep'
                    : 'text-white/85 hover:bg-white/10 hover:text-white'
                }`}
              >
                {getChainName(id)}
              </button>
            ))}
          </div>
          <WalletButton onBrand />
        </div>
      </div>

      <nav
        className="md:hidden flex gap-1.5 overflow-x-auto border-t border-white/25 px-4 py-2.5"
        aria-label="Mobile"
      >
        {NAV.map((item) => {
          const active = pathname?.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ${
                active ? 'bg-white text-orange-deep font-semibold' : 'text-white/90 bg-white/10'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
