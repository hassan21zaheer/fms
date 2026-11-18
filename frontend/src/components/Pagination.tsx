import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  lastPage: number;
  total: number;
  pageSize: number;
  noun: string;
  onChange: (page: number) => void;
}

/** Previous / next controls with "Showing 13-24 of 230 records" underneath a table. */
export function Pagination({ page, lastPage, total, pageSize, noun, onChange }: PaginationProps) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const buttonClass =
    'inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-[#15151A] text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-zinc-400 font-semibold">
      <span>
        Showing {from}-{to} of {total} {noun}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className={buttonClass} disabled={page <= 1} onClick={() => onChange(1)}>
          First
        </button>
        <button type="button" className={buttonClass} disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Previous</span>
        </button>
        <span className="px-2 tabular-nums">
          Page {page} of {lastPage}
        </span>
        <button type="button" className={buttonClass} disabled={page >= lastPage} onClick={() => onChange(page + 1)}>
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button type="button" className={buttonClass} disabled={page >= lastPage} onClick={() => onChange(lastPage)}>
          Last
        </button>
      </div>
    </div>
  );
}
