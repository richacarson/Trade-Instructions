// Paradiem logo — recreated as an inline SVG mark + wordmark so it renders
// crisply at any size and inherits the surrounding text color.
// Swap PARADIEM_MARK for the official artwork if a vector file is provided.

function Emblem({ className }) {
  return (
    <svg
      viewBox="0 0 48 62"
      className={className}
      fill="currentColor"
      aria-hidden="true"
    >
      {/* star */}
      <path d="M24 1 L26.4 5.6 L31 8 L26.4 10.4 L24 15 L21.6 10.4 L17 8 L21.6 5.6 Z" />
      {/* crown bars */}
      <rect x="13" y="19" width="4" height="9" />
      <rect x="19" y="11" width="4" height="17" />
      <rect x="25" y="11" width="4" height="17" />
      <rect x="31" y="19" width="4" height="9" />
      {/* shield */}
      <path d="M8 24 H40 V40 C40 50.5 33 57 24 61 C15 57 8 50.5 8 40 Z" />
    </svg>
  )
}

const HEIGHTS = { sm: 'h-7', md: 'h-9', lg: 'h-14' }
const WORD = { sm: 'text-xl', md: 'text-2xl', lg: 'text-4xl' }

export default function Logo({ variant = 'full', size = 'md', className = '' }) {
  const h = HEIGHTS[size] ?? HEIGHTS.md
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {variant !== 'wordmark' ? <Emblem className={`${h} w-auto`} /> : null}
      {variant !== 'mark' ? (
        <span
          className={`font-display font-bold leading-none tracking-tight ${WORD[size] ?? WORD.md}`}
        >
          Paradiem
        </span>
      ) : null}
    </span>
  )
}
