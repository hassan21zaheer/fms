import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface LiquidMetalBorderProps {
  borderRadius?: number;
  borderWidth?: number;
  duration?: number;
  /** 'dark' = bright chrome for dark backgrounds, 'light' = steel tones for light backgrounds */
  tone?: 'dark' | 'light';
  className?: string;
  children?: ReactNode;
}

const GRADIENTS: Record<'dark' | 'light', string> = {
  dark: 'conic-gradient(from var(--liquid-angle), #f8fafc, #94a3b8, #ffffff, #64748b, #e2e8f0, #94a3b8, #f8fafc)',
  light:
    'conic-gradient(from var(--liquid-angle), #475569, #e2e8f0, #1e293b, #cbd5e1, #64748b, #e2e8f0, #475569)',
};

const MASK =
  'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)';

/**
 * @name Liquid Metal Border
 * @description A continuously rotating molten-chrome conic gradient border ring
 * with a soft outer glow. Pure CSS (uses `@property --liquid-angle` registered
 * in index.css); gradient renders statically in browsers without `@property`.
 */
export function LiquidMetalBorder({
  borderRadius = 12,
  borderWidth = 1.5,
  duration = 5,
  tone = 'dark',
  className,
  children,
}: LiquidMetalBorderProps) {
  const gradient = GRADIENTS[tone];

  return (
    <div
      className={cn('relative', className)}
      style={{ '--liquid-duration': `${duration}s` } as CSSProperties}
    >
      {/* Molten glow behind the ring */}
      <span
        aria-hidden
        className="liquid-metal-spin pointer-events-none absolute -inset-[3px] opacity-40 blur-[10px]"
        style={{ background: gradient, borderRadius: borderRadius + 6 }}
      />
      {/* Ring (masked to border width) */}
      <span
        aria-hidden
        className="liquid-metal-spin pointer-events-none absolute inset-0"
        style={{
          background: gradient,
          borderRadius,
          padding: borderWidth,
          mask: MASK,
          WebkitMask: MASK,
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
