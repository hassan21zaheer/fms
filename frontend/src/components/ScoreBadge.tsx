interface ScoreBadgeProps {
  score: number;
  showBand?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ScoreBadge({ score, showBand = false, size = 'md', className = '' }: ScoreBadgeProps) {
  let band = 'Critical';
  let colorClasses = 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
  let dotColor = 'bg-rose-500';

  if (score >= 80) {
    band = 'Excellent';
    colorClasses = 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    dotColor = 'bg-emerald-500';
  } else if (score >= 60) {
    band = 'Good';
    colorClasses = 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
    dotColor = 'bg-amber-500';
  } else if (score >= 40) {
    band = 'Needs Attention';
    colorClasses = 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30';
    dotColor = 'bg-yellow-400';
  }

  const sizeClasses =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs font-medium'
      : size === 'lg'
      ? 'px-3.5 py-1.5 text-sm font-semibold'
      : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full tabular-nums tracking-wide ${sizeClasses} ${colorClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      <span>{score}</span>
      {showBand && <span className="opacity-80 font-normal">· {band}</span>}
    </span>
  );
}
