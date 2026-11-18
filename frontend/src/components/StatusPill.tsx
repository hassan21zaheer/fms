import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export type StatusValue = 'open' | 'in_progress' | 'resolved' | 'verified';

interface StatusPillProps {
  status: StatusValue;
  onChange?: (newStatus: StatusValue) => void;
  disabled?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<
  StatusValue,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  open: {
    label: 'Open',
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
    dot: 'bg-amber-500',
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-blue-500/10 dark:bg-blue-500/15',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-500/30',
    dot: 'bg-blue-500',
  },
  resolved: {
    label: 'Resolved',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-500',
  },
  verified: {
    label: 'Verified',
    bg: 'bg-violet-500/10 dark:bg-violet-500/15',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-500/30',
    dot: 'bg-violet-400',
  },
};

export function StatusPill({ status, onChange, disabled = false, className = '' }: StatusPillProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.open;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled || !onChange}
        onClick={(e) => {
          e.stopPropagation();
          if (onChange && !disabled) setIsOpen(!isOpen);
        }}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${config.bg} ${config.text} ${config.border} ${
          onChange && !disabled ? 'cursor-pointer hover:opacity-90 active:scale-95' : 'cursor-default'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        <span>{config.label}</span>
        {onChange && !disabled && (
          <ChevronDown className="w-3 h-3 opacity-60 ml-0.5 transition-transform" />
        )}
      </button>

      {isOpen && onChange && (
        <div className="absolute left-0 mt-1.5 w-36 py-1 z-50 rounded-xl bg-white dark:bg-[#1A1A22] border border-slate-200 dark:border-white/10 shadow-xl text-xs">
          {(Object.keys(STATUS_CONFIG) as StatusValue[]).map((val) => {
            const item = STATUS_CONFIG[val];
            const isSelected = val === status;
            return (
              <button
                key={val}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(val);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-white/5 transition-colors ${
                  isSelected ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                  <span>{item.label}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
