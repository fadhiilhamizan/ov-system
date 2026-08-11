/**
 * Password rules, in one place so Daftar and Ubah Kata Sandi cannot drift.
 *
 * Pure functions on purpose: the real enforcement is Supabase Auth's own
 * policy, and these only exist so the user is told what is wrong BEFORE a
 * round-trip. Anything the server rejects still surfaces through
 * `authErrorMessage`.
 */
export const MIN_PASSWORD = 8;

export type PasswordCheck = { ok: true } | { ok: false; error: string };

/** Rules for choosing a NEW password. `current` is optional — pass it on a
 *  change so "reusing the same password" is caught before the round-trip. */
export function checkNewPassword(
  next: string,
  confirm: string,
  current?: string,
): PasswordCheck {
  if (next.length < MIN_PASSWORD) {
    return { ok: false, error: `Kata sandi baru minimal ${MIN_PASSWORD} karakter.` };
  }
  if (next !== confirm) {
    return { ok: false, error: "Konfirmasi kata sandi tidak cocok." };
  }
  // Not a security rule, a usability one: silently "changing" a password to
  // itself looks like the feature did nothing.
  if (current !== undefined && current.length > 0 && next === current) {
    return { ok: false, error: "Kata sandi baru harus berbeda dari kata sandi saat ini." };
  }
  return { ok: true };
}
