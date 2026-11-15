/** Varied abstract sample art (SVG data URIs) — playful, not Shiba imagery.
 *  Orange and blue may appear as separate solid shapes; no cross-hue gradients.
 */

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export const SAMPLE_ART: string[] = [
  svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fdba74"/>
      <stop offset="100%" stop-color="#c2410c"/>
    </linearGradient>
  </defs>
  <rect width="400" height="400" fill="#fff7ed"/>
  <circle cx="130" cy="150" r="100" fill="url(#g)"/>
  <rect x="60" y="280" width="280" height="48" rx="24" fill="#c2410c"/>
  <circle cx="310" cy="90" r="42" fill="#2563eb"/>
</svg>`),
  svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#dbeafe"/>
  <path d="M0 260 Q100 180 200 260 T400 240 L400 400 L0 400 Z" fill="#1d4ed8"/>
  <path d="M0 300 Q120 220 240 300 T400 280 L400 400 L0 400 Z" fill="#2563eb" opacity="0.75"/>
  <circle cx="320" cy="90" r="48" fill="#93c5fd"/>
</svg>`),
  svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#ffedd5"/>
  <rect x="40" y="40" width="140" height="140" rx="28" fill="#ea580c" transform="rotate(-8 110 110)"/>
  <rect x="180" y="100" width="160" height="160" rx="32" fill="#c2410c" transform="rotate(6 260 180)"/>
  <rect x="80" y="240" width="220" height="100" rx="40" fill="#fdba74" opacity="0.95"/>
</svg>`),
  svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="r" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#93c5fd"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="url(#r)"/>
  <circle cx="200" cy="200" r="70" fill="#eff6ff" opacity="0.95"/>
  <circle cx="200" cy="200" r="36" fill="#1d4ed8"/>
</svg>`),
  svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#1d4ed8"/>
  <circle cx="80" cy="80" r="60" fill="#60a5fa"/>
  <circle cx="340" cy="320" r="80" fill="#93c5fd"/>
  <path d="M40 200 H360" stroke="#eff6ff" stroke-width="18" stroke-linecap="round"/>
  <path d="M40 250 H280" stroke="#bfdbfe" stroke-width="12" stroke-linecap="round" opacity="0.9"/>
</svg>`),
  svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#fff7ed"/>
  <polygon points="200,40 360,320 40,320" fill="#ea580c"/>
  <polygon points="200,100 300,300 100,300" fill="#c2410c" opacity="0.9"/>
  <circle cx="200" cy="240" r="28" fill="#fff8f1"/>
</svg>`),
]

/** Deterministic placeholder art from an address when no image is set. */
export function placeholderArtFromAddress(address: string): string {
  const idx =
    address
      .toLowerCase()
      .split('')
      .reduce((a, c) => a + c.charCodeAt(0), 0) % SAMPLE_ART.length
  return SAMPLE_ART[idx]
}

export function shortCollectionLabel(nft: string, fallbackName?: string): string {
  if (fallbackName) return fallbackName
  if (!nft || nft.length < 10) return 'Collection'
  return `Collection ${nft.slice(2, 6).toUpperCase()}…${nft.slice(-4)}`
}
