// ============================================================
// What the user is told when Violet cannot answer.
//
// Violet runs on free API tiers, so "out of quota" is not an exotic failure,
// it is a Tuesday. The old code passed Google's own English wording straight
// into the chat bubble, which meant a student on the rundown page got
// "Layanan Violet menolak permintaan: You exceeded your current quota, please
// check your plan and billing details" and no idea what to do next.
//
// Every failure is therefore classified into one of a handful of causes, and
// each cause has: plain Indonesian copy, whether RETRYING could help (the chat
// shows a retry button only then), and whether another provider should be
// tried instead (see ./llm).
// ============================================================

export type VioletErrorCode =
  /** No provider is configured at all. An admin problem, not a user one. */
  | "not_configured"
  /** Daily/monthly free-tier allowance is gone. Waiting is the only fix. */
  | "quota"
  /** Too many requests in a short window. Waiting a moment IS the fix. */
  | "rate_limit"
  /** The key was rejected: wrong, revoked, or not enabled for the model. */
  | "auth"
  /** Provider is down or overloaded. */
  | "unavailable"
  /** The provider did not answer in time. */
  | "timeout"
  /** We could not reach the provider at all. */
  | "network"
  /** The model refused on safety grounds. */
  | "safety"
  /** The model answered with nothing usable. */
  | "empty"
  /** Anything we could not place. */
  | "unknown";

export interface VioletError {
  code: VioletErrorCode;
  /** The provider's own wording. Logged, never shown verbatim. */
  detail?: string;
}

interface Copy {
  message: string;
  /** Show a "try again" button. */
  retryable: boolean;
  /** Worth asking the next provider in the chain. */
  failover: boolean;
}

/**
 * Copy is Indonesian to match the rest of the app's error strings, and says
 * what the user can DO. "Coba lagi" with no button is a dead end, so the
 * wording and the `retryable` flag are kept together on purpose.
 */
const COPY: Record<VioletErrorCode, Copy> = {
  not_configured: {
    message:
      "Violet belum aktif. Admin perlu mengisi kunci API (GEMINI_API_KEY atau GROQ_API_KEY) di server.",
    retryable: false,
    failover: true,
  },
  quota: {
    message:
      "Kuota harian Violet sudah habis. Violet memakai layanan AI gratis yang jatahnya diatur ulang setiap hari, jadi coba lagi besok. Sementara itu, jawabannya kemungkinan ada di menu Panduan atau FAQ.",
    retryable: false,
    failover: true,
  },
  rate_limit: {
    message:
      "Violet sedang ramai dipakai. Tunggu sekitar satu menit, lalu kirim ulang pertanyaanmu.",
    retryable: true,
    failover: true,
  },
  auth: {
    message:
      "Kunci API Violet ditolak layanan AI-nya. Ini masalah konfigurasi di server, bukan di perangkatmu. Hubungi admin sistem.",
    retryable: false,
    failover: true,
  },
  unavailable: {
    message: "Layanan AI yang dipakai Violet sedang bermasalah. Coba lagi beberapa saat lagi.",
    retryable: true,
    failover: true,
  },
  timeout: {
    message:
      "Violet terlalu lama menjawab dan permintaannya dihentikan. Coba kirim ulang, atau persingkat pertanyaanmu.",
    retryable: true,
    failover: true,
  },
  network: {
    message: "Violet tidak bisa menghubungi layanan AI-nya. Periksa koneksi internet, lalu coba lagi.",
    retryable: true,
    failover: true,
  },
  safety: {
    message: "Violet tidak bisa menjawab pertanyaan itu. Coba tanyakan hal lain seputar sistem ini.",
    retryable: false,
    failover: false,
  },
  empty: {
    message: "Violet tidak jadi menjawab. Coba ulangi pertanyaannya dengan kalimat yang berbeda.",
    retryable: true,
    failover: true,
  },
  unknown: {
    message: "Violet gagal menjawab karena kendala teknis. Coba lagi sebentar lagi.",
    retryable: true,
    failover: true,
  },
};

export const violetErrorMessage = (code: VioletErrorCode): string => COPY[code].message;
export const isRetryable = (code: VioletErrorCode): boolean => COPY[code].retryable;
export const shouldFailover = (code: VioletErrorCode): boolean => COPY[code].failover;

/**
 * Read an HTTP status plus the provider's message into a cause.
 *
 * Both providers return 429 for two very different situations: "you have run
 * out for today" and "you are going too fast". Only the wording tells them
 * apart, and the difference matters, because one is worth retrying in a minute
 * and the other is not worth retrying at all today.
 */
export function classifyHttp(status: number, detail = ""): VioletErrorCode {
  const d = detail.toLowerCase();

  if (status === 429) {
    const perMinute = /per minute|per-minute|rpm|tpm|requests per|too many requests|rate.?limit/.test(d);
    const exhausted = /quota|per day|per-day|daily|billing|exceeded your current|insufficient/.test(d);
    if (exhausted && !perMinute) return "quota";
    return perMinute ? "rate_limit" : "quota";
  }
  if (status === 401 || status === 403) return "auth";
  if (status === 400 && /api key|api_key|credential/.test(d)) return "auth";
  if (status === 404) return "unavailable"; // retired model alias, most likely
  if (status === 408) return "timeout";
  if (status >= 500) return "unavailable";
  if (/quota|resource_exhausted/.test(d)) return "quota";
  return "unknown";
}
