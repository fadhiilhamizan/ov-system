// ============================================================
// "This tab is running an older build than the server."
//
// Every deploy to Vercel replaces the Server Actions and the JS chunks. A tab
// that was opened before the deploy still holds the OLD action ids and chunk
// names, so its next save is answered with "Server Action ... was not found"
// and its next lazy import with a ChunkLoadError. Before this module, the save
// path read that as a generic network failure ("Gagal menyimpan. Periksa
// koneksi internet"), rolled the edit back, and the very next click did the
// same - people saw it as the app erroring and throwing them out, repeatedly,
// right after every release.
//
// The fix is to recognise it and say the true thing: the app was updated,
// reload to continue. `StaleBuildNotice` (components/layout) shows that, once.
// Enabling Vercel's Skew Protection for the project removes most of these at
// the source (Next reads NEXT_DEPLOYMENT_ID automatically); this is the half
// that holds without it.
//
// Pure apart from the event dispatch, so the matching is unit-tested.
// ============================================================

export const STALE_BUILD_EVENT = "ov:stale-build";

const PATTERNS = [
  /server action .*not found/i,
  /failed to find server action/i,
  /ChunkLoadError/i,
  /loading (css )?chunk [\w-]+ failed/i,
  /failed to fetch dynamically imported module/i,
  /importing a module script failed/i,
  /error loading dynamically imported module/i,
];

/** Is this error the signature of an outdated tab after a deploy? */
export function isStaleBuildError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { message?: unknown; name?: unknown };
  const text = `${typeof e.name === "string" ? e.name : ""} ${typeof e.message === "string" ? e.message : String(error)}`;
  return PATTERNS.some((p) => p.test(text));
}

/** Tell the shell to show the "reload" notice. Safe to call many times. */
export function announceStaleBuild() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STALE_BUILD_EVENT));
}

/**
 * Run a save; if it THROWS (it never reached a verdict), wait and try once
 * more. A `{ ok: false }` answer is a verdict and is returned as-is. An
 * outdated build is announced instead of retried: the second call would fail
 * the same way.
 */
export async function withOneRetry<R>(save: () => Promise<R>, delayMs = 700): Promise<R> {
  try {
    return await save();
  } catch (e) {
    if (isStaleBuildError(e)) {
      announceStaleBuild();
      throw e;
    }
    await new Promise((r) => setTimeout(r, delayMs));
    try {
      return await save();
    } catch (e2) {
      if (isStaleBuildError(e2)) announceStaleBuild();
      throw e2;
    }
  }
}
