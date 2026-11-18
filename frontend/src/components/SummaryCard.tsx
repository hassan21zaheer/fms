import { TrendingUp, TrendingDown } from 'lucide-react';
import { WaveDecoration } from './WaveDecoration';

interface SummaryCardProps {
  label: string;
  count: number | string;
  delta?: {
    value: string;
    isPositive: boolean;
  };
  caption?: string;
  badgeBg: string;
  badgeText: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function SummaryCard({
  label,
  count,
  delta,
  caption = 'Than last week',
  badgeBg,
  badgeText,
  active = false,
  onClick,
  className = '',
}: SummaryCardProps) {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden p-5 rounded-[22px] bg-white dark:bg-[#15151A] border transition-all duration-200 cursor-pointer ${
        active
          ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
          : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
      } ${className}`}
    >
      {/* Decorative Wave in bottom background */}
      <WaveDecoration className="absolute -bottom-4 -right-10 w-44 h-24 text-slate-400 dark:text-zinc-600" />

      {/* Top pill/header */}
      <div className="relative z-10 flex items-center justify-between">
        <span
          className={`inline-block px-4 py-1.5 rounded-full text-xs font-semibold ${badgeBg} ${badgeText}`}
        >
          {label}
        </span>
      </div>

      {/* Main Count & Delta */}
      <div className="relative z-10 mt-5 flex items-baseline gap-3">
        <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
          {count}
        </span>
        {delta && (
          <span
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
              delta.isPositive
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
            }`}
          >
            {delta.isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {delta.value}
          </span>
        )}
      </div>

      <p className="relative z-10 mt-2 text-xs text-slate-400 dark:text-zinc-500">{caption}</p>
    </div>
  );
}
