export function WaveDecoration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`pointer-events-none select-none overflow-hidden opacity-30 dark:opacity-20 ${className}`}
      aria-hidden="true"
    >
      <path
        d="M-40 80 C 40 10, 100 110, 180 50 C 240 5, 290 85, 360 40"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M-20 95 C 60 25, 120 125, 200 65 C 260 20, 310 100, 380 55"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="3 3"
      />
      <path
        d="M0 110 C 80 40, 140 140, 220 80 C 280 35, 330 115, 400 70"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}
