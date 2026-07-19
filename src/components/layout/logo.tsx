import { cn } from "@/lib/utils";

export function Logo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
        <defs>
          <linearGradient id="ovlogo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6366f1" />
            <stop offset="1" stopColor="#4338ca" />
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="37" height="37" rx="10.5" fill="url(#ovlogo)" />
        <rect x="5" y="5" width="30" height="30" rx="7" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="1" />
        <circle cx="15.5" cy="20" r="6" fill="none" stroke="#fff" strokeWidth="2.8" />
        <path
          d="M22.5 14 L26.5 26.5 L30.5 14"
          fill="none"
          stroke="#fff"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
