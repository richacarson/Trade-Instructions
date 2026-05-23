const HEIGHTS = { sm: 'h-7', md: 'h-9', lg: 'h-14' }

const base = import.meta.env.BASE_URL

export default function Logo({ variant = 'full', size = 'md', className = '' }) {
  const h = HEIGHTS[size] ?? HEIGHTS.md
  const src =
    variant === 'mark'
      ? `${base}paradiem-shield-white.png`
      : variant === 'wordmark'
        ? `${base}paradiem-logo-white.png`
        : `${base}paradiem-logo-white.png`
  return (
    <span className={`inline-flex items-center ${className}`}>
      <img src={src} alt="Paradiem" className={`${h} w-auto`} />
    </span>
  )
}
