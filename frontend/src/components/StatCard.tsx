import { ArrowUpRight, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  delta?: {
    value: string;
    isPositive: boolean;
  };
  caption?: string;
  isHighlighted?: boolean;
  onClickArrow?: () => void;
  className?: string;
}

export function StatCard({
  title,
  value,
  subValue,
  delta,
  caption = 'This month vs last',
  isHighlighted = false,
  onClickArrow,
  className = '',
}: StatCardProps) {
  if (isHighlighted) {
    return (
      <div
        className={`relative flex flex-col justify-between p-6 rounded-[24px] transition-all duration-200 shadow-sm overflow-hidden ${
          // In dark mode: Crisp White Card with Dark Text. In light mode: Rich Indigo Card with White Text!
          'dark:bg-white dark:text-zinc-900 bg-[#4338F5] text-white'
        } ${className}`}
      >
        <div className="flex items-start justify-between">
          <span className="text-sm font-medium opacity-80">{title}</span>
          <button
            type="button"
            onClick={onClickArrow}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95 ${
              'dark:bg-[#4338F5] dark:text-white bg-white text-[#4338F5]'
            }`}
            aria-label="View metric details"
          >
            <ArrowUpRight className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl lg:text-4xl font-extrabold tracking-tight tabular-nums">
              {value}
            </span>
            {subValue && (
              <span className="text-sm font-semibold opacity-70 tabular-nums">
                {subValue}
              </span>
            )}
            {delta && (
              <span
                className={`ml-1 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                  'dark:bg-emerald-100 dark:text-emerald-800 bg-white/20 text-white'
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
          <p className="mt-2 text-xs opacity-70">{caption}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col justify-between p-6 rounded-[24px] bg-[#15151A] dark:bg-[#15151A] bg-white border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white transition-all duration-200 shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-slate-500 dark:text-zinc-400">{title}</span>
        <button
          type="button"
          onClick={onClickArrow}
          className="w-9 h-9 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
          aria-label="View metric details"
        >
          <ArrowUpRight className="w-4 h-4 stroke-[2]" />
        </button>
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-3xl font-extrabold tracking-tight tabular-nums">
            {value}
          </span>
          {subValue && (
            <span className="text-sm font-semibold text-slate-400 dark:text-zinc-500 tabular-nums">
              {subValue}
            </span>
          )}
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
        <p className="mt-2 text-xs text-slate-400 dark:text-zinc-500">{caption}</p>
      </div>
    </div>
  );
}
