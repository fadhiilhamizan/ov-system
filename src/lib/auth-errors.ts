/**
 * Turn a Supabase auth error into something a human can act on.
 *
 * WHY THIS EXISTS: `@supabase/auth-js` builds its message via
 *   err.msg ?? err.message ?? err.error_description ?? err.error ?? JSON.stringify(err)
 * so when the Auth server replies with a body that has none of those fields,
 * the message becomes the literal string "{}". Users saw exactly that on the
 * login and signup pages and had nothing to go on.
 *
 * The real trigger was accounts inserted into `auth.users` by hand from SQL
 * without GoTrue's token columns (`confirmation_token` and friends). Postgres
 * allows NULL there; GoTrue scans them into Go strings and dies with
 * "converting NULL to string is unsupported", returning a 500 with no body.
 * `supabase/default-accounts.sql` repairs those rows - this function makes sure
 * the symptom is legible while that is happening.
 *
 * Anything the server DID phrase is passed through untouched.
 */

/** A message that is nothing but a JSON blob carries no information for a user. */
const JSON_BLOB = /^\s*[[{][\s\S]*[\]}]\s*$/;

export function authErrorMessage(
  error: { message?: string | null; status?: number } | null | undefined,
): string {
  const raw = (error?.message ?? "").trim();
  if (raw && !JSON_BLOB.test(raw)) return raw;

  const status = error?.status;
  if (status && status >= 500) {
    return `Server autentikasi sedang bermasalah (kode ${status}) dan tidak mengirim pesan error. Coba lagi sebentar lagi, atau hubungi admin kalau terus terjadi.`;
  }
  return "Gagal masuk: server tidak mengirim pesan error. Periksa email & kata sandi, lalu coba lagi. Kalau terus terjadi, hubungi admin.";
}
