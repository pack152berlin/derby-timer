/**
 * Custom chevron icons — Concept A "Lily Tip".
 * Standard chevron with a filled circle at the point tip (fleur-de-lis petal nod).
 * API matches lucide-react: size + className props.
 */

interface Props {
  size?: number;
  className?: string;
}

function LilyChevron({
  path, cx, cy, size, className,
}: Props & { path: string; cx: number; cy: number }) {
  const dim = size ? { width: size, height: size } : {};
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...dim}
    >
      <path d={path} />
      <circle cx={cx} cy={cy} r={2} fill="currentColor" stroke="none" />
    </svg>
  );
}

export function LilyChevronDown({ size, className }: Props) {
  return <LilyChevron path="M6 9 L12 15 L18 9" cx={12} cy={16.5} size={size} className={className} />;
}

export function LilyChevronUp({ size, className }: Props) {
  return <LilyChevron path="M6 15 L12 9 L18 15" cx={12} cy={7.5} size={size} className={className} />;
}

export function LilyChevronLeft({ size, className }: Props) {
  return <LilyChevron path="M15 6 L9 12 L15 18" cx={7.5} cy={12} size={size} className={className} />;
}

export function LilyChevronRight({ size, className }: Props) {
  return <LilyChevron path="M9 6 L15 12 L9 18" cx={16.5} cy={12} size={size} className={className} />;
}
