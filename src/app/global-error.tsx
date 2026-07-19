"use client";
import * as React from "react";

/**
 * Last-resort error boundary. Replaces the ROOT layout (including <html>),
 * so it can't rely on providers, fonts, theme, or the design-token CSS —
 * everything here is inlined and self-contained. Only trips when the root
 * layout itself fails; ordinary page errors are caught by (app)/error.tsx.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Global error boundary:", error);
  }, [error]);

  return (
    <html lang="id">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <style>{`
          @media (prefers-color-scheme: dark) {
            body { background: #0b1120 !important; color: #e2e8f0 !important; }
            .ge-card { background: #111827 !important; border-color: #1f2937 !important; }
            .ge-muted { color: #94a3b8 !important; }
            .ge-btn-2 { background: #1f2937 !important; color: #e2e8f0 !important; border-color: #374151 !important; }
          }
        `}</style>
        <div
          className="ge-card"
          style={{
            maxWidth: 420,
            width: "calc(100% - 32px)",
            padding: "28px 24px",
            borderRadius: 16,
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            textAlign: "center",
            boxShadow: "0 8px 30px rgba(2,6,23,0.08)",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              margin: "0 auto 16px",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(239,68,68,0.12)",
              color: "#ef4444",
              fontSize: 24,
            }}
            aria-hidden
          >
            !
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 6px" }}>
            Aplikasi bermasalah
          </h1>
          <p className="ge-muted" style={{ fontSize: 14, margin: "0 0 20px", color: "#64748b" }}>
            Terjadi kesalahan tak terduga. Silakan muat ulang halaman.
          </p>
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={reset}
              style={{
                height: 40,
                padding: "0 18px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 500,
                background: "#2563eb",
                color: "#ffffff",
              }}
            >
              Coba lagi
            </button>
            <a
              href="/dashboard"
              className="ge-btn-2"
              style={{
                height: 40,
                padding: "0 18px",
                borderRadius: 10,
                border: "1px solid #e2e8f0",
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 500,
                background: "#ffffff",
                color: "#0f172a",
              }}
            >
              Ke Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
