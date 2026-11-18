import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';

interface GuestHeroProps {
  brand: string;
  name: string;
  subtitle: string;
  logoSrc?: string | null;
  celebrate?: boolean;
}

const CHIPS = [
  { icon: '⭐', className: 'left-[8%] top-[18%]', depth: 70, delay: '0s' },
  { icon: '😍', className: 'right-[9%] top-[26%]', depth: 95, delay: '-1.6s' },
  { icon: '👍', className: 'left-[16%] bottom-[16%]', depth: 55, delay: '-3.1s' },
  { icon: '💬', className: 'right-[17%] bottom-[12%]', depth: 80, delay: '-2.2s' },
];

/**
 * Animated welcome header for the guest form: a glowing ring and floating rating chips that
 * tilt in 3D with the finger or mouse. Pure CSS and SVG, and it stands still for people who
 * prefer reduced motion.
 */
export function GuestHero({ brand, name, subtitle, logoSrc, celebrate = false }: GuestHeroProps) {
  const stage = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMove = (event: PointerEvent<HTMLDivElement>) => {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return;
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    setTilt({ x: Math.max(-0.5, Math.min(0.5, x)), y: Math.max(-0.5, Math.min(0.5, y)) });
  };

  const sceneStyle: CSSProperties = {
    transform: `rotateX(${(-tilt.y * 22).toFixed(1)}deg) rotateY(${(tilt.x * 28).toFixed(1)}deg)`,
    transition: 'transform 180ms ease-out',
    transformStyle: 'preserve-3d',
  };

  return (
    <div className="text-center">
      <div
        ref={stage}
        onPointerMove={handleMove}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        className="relative mx-auto h-56 w-full select-none overflow-hidden rounded-3xl touch-pan-y"
        style={{
          perspective: '900px',
          background: `radial-gradient(120% 90% at 50% 40%, ${brand}26 0%, transparent 70%), linear-gradient(180deg, ${brand}12, transparent)`,
        }}
        aria-hidden="true"
      >
        <div className="absolute inset-0" style={sceneStyle}>
          <div className="fms-sway absolute inset-0" style={{ transformStyle: 'preserve-3d' }}>
            {/* soft colour glow behind the ring */}
            <div
              className="fms-pulse absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl"
              style={{ background: `conic-gradient(from 90deg, ${brand}, #f472b6, #38bdf8, ${brand})`, opacity: 0.45 }}
            />

            {/* spinning gradient ring */}
            <div
              className="fms-spin absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background: `conic-gradient(from 0deg, ${brand}, #f472b6, #fb923c, #38bdf8, ${brand})`,
                WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 6px))',
                mask: 'radial-gradient(farthest-side, transparent calc(100% - 7px), #000 calc(100% - 6px))',
                transform: 'translateZ(20px)',
              }}
            />

            {/* the organization mark in the middle */}
            <div
              className="absolute left-1/2 top-1/2 -ml-10 -mt-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl text-3xl font-extrabold text-white shadow-2xl"
              style={{ backgroundColor: brand, transform: 'translateZ(60px)' }}
            >
              {logoSrc ? (
                <img src={logoSrc} alt="" className="h-full w-full object-cover" />
              ) : celebrate ? (
                '✓'
              ) : (
                name.charAt(0).toUpperCase()
              )}
            </div>

            {/* floating glass chips at different depths */}
            {CHIPS.map((chip) => (
              <div
                key={chip.icon}
                className={`absolute ${chip.className}`}
                style={{ transform: `translateZ(${chip.depth}px)`, transformStyle: 'preserve-3d' }}
              >
                <div
                  className="fms-float flex h-11 w-11 items-center justify-center rounded-2xl border border-white/40 bg-white/60 text-xl shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-white/10"
                  style={{ animationDelay: chip.delay }}
                >
                  {chip.icon}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{name}</h1>
        <p className="mx-auto max-w-xs text-xs text-slate-500 dark:text-zinc-400">{subtitle}</p>
      </div>
    </div>
  );
}
