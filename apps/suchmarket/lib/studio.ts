/** Tentative default until Max confirms studio production URL. */
const DEFAULT_STUDIO_URL = 'https://cryptoart.studio'

export function getStudioUrl(): string {
  const configured = process.env.NEXT_PUBLIC_STUDIO_URL?.trim()
  return configured || DEFAULT_STUDIO_URL
}

export function studioUrl(path = ''): string {
  const base = getStudioUrl().replace(/\/$/, '')
  if (!path) return base
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}