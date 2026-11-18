import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../../lib/utils';

type TColorProp = string | string[];

interface ShineBorderProps {
  borderRadius?: number;
  borderWidth?: number;
  duration?: number;
  color?: TColorProp;
  className?: string;
  children: ReactNode;
}

/**
 * @name Shine Border
 * @description An animated background border effect component with easy to use and configurable props.
 * Tailwind v4 adaptation: var shorthand converted to `(...)` / `var()` syntax,
 * and the shine animation is registered via `--animate-shine` in index.css.
 */
export function ShineBorder({
  borderRadius = 8,
  borderWidth = 1,
  duration = 14,
  color = '#000000',
  className,
  children,
}: ShineBorderProps) {
  return (
    <div
      style={
        {
          '--border-radius': `${borderRadius}px`,
        } as CSSProperties
      }
      className={cn(
        'relative min-h-[60px] w-fit min-w-[300px] rounded-(--border-radius) place-items-center p-3',
        className,
      )}
    >
      <div
        style={
          {
            '--border-width': `${borderWidth}px`,
            '--border-radius': `${borderRadius}px`,
            '--duration': `${duration}s`,
            '--mask-linear-gradient':
              'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            '--background-radial-gradient': `radial-gradient(transparent, transparent, ${
              color instanceof Array ? color.join(',') : color
            }, transparent, transparent)`,
          } as CSSProperties
        }
        className="before:bg-shine-size before:absolute before:inset-0 before:aspect-square before:size-full before:rounded-(--border-radius) before:p-(--border-width) before:will-change-[background-position] before:content-[''] before:![-webkit-mask-composite:xor] before:![mask-composite:exclude] before:[background-image:var(--background-radial-gradient)] before:[background-size:300%_300%] before:[mask:var(--mask-linear-gradient)] motion-safe:before:animate-shine"
      />
      {children}
    </div>
  );
}
