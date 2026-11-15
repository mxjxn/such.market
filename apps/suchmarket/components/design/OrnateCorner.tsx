export function OrnateCorner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4 44C4 20 20 4 44 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M8 40C8 24 24 8 40 8"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.6"
      />
      <circle cx="6" cy="42" r="2" fill="currentColor" opacity="0.8" />
      <path
        d="M12 36C16 28 28 16 36 12"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.4"
      />
      <path d="M20 28L24 24M28 20L32 16" stroke="currentColor" strokeWidth="0.6" opacity="0.5" />
    </svg>
  )
}
