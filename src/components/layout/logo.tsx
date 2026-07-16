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
            <stop offset="0" stopColor="#818cf8" />
            <stop offset="1" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <rect x="1.5" y="1.5" width="37" height="37" rx="11" fill="url(#ovlogo)" />
        <path
          d="M12 13.5c0-.4.4-.6.7-.4l7 4.4c.3.2.3.7 0 .9l-7 4.4c-.3.2-.7 0-.7-.4V13.5Z"
          fill="#fff"
          opacity="0.95"
        />
        <circle cx="27" cy="18.5" r="4.2" fill="#fff" opacity="0.95" />
        <path
          d="M13 27.5h14"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>
    </span>
  );
}
