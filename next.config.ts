import type { NextConfig } from "next";

// Supabase is contacted directly from the browser (auth + PostgREST), so its
// origins have to be allowed in connect-src or every request is blocked.
const supabaseOrigins = [
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_DEMO_URL,
]
  .filter(Boolean)
  .join(" ");

/**
 * Second line of defence. None of these fix a bug we have — the point is that
 * they turn a hypothetical future XSS into a blocked request instead of a
 * stolen session, and stop the app being framed by someone else's page.
 *
 * 'unsafe-inline' on style-src is required by Tailwind's runtime styles, and on
 * script-src by Next's inline bootstrap. Moving script-src to a nonce is the
 * next step up, but it needs the whole app re-tested, so it is deliberately not
 * bundled into this change.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigins}`.trim(),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Hide the floating Next.js dev indicator ("N" button).
  devIndicators: false,

  // The app uses no `next/image` at all (every graphic is inline SVG), so the
  // image optimizer — and with it `sharp`, which currently carries unpatched
  // libvips CVEs through Next's own dependency tree — is never invoked. Saying
  // so explicitly keeps it that way if someone adds an <img> later.
  images: { unoptimized: true },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },
};

export default nextConfig;
