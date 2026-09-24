"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { DEMO_COOKIE, demoActive } from "@/lib/demo";
import { updateMyProfile } from "@/lib/data/repo";
import { myProfileSchema, parse } from "./schemas";
import { errMsg } from "./lock";

// ============================================================
// Editing your OWN account.
//
// The only action in the app with no `can.*` check, and that is not an
// oversight: there is no role that may or may not edit their own display name.
// What stops this being a self-promotion hole is that it cannot NAME anybody
// else (no user id parameter) and cannot REACH the dangerous columns (the
// schema lists two fields, and `profiles` only grants UPDATE on three columns
// to `authenticated` - `role`, `division` and `is_shared` are not among them).
//
// A guest IS refused, because an anonymous session has no profile row to edit.
// ============================================================

type Result = { ok: true } | { ok: false; error: string };

export async function updateMyProfileAction(input: {
  name: string;
  avatar?: string | null;
}): Promise<Result> {
  // Mode Demo tidak memakai login sama sekali: identitasnya datang dari tombol
  // peran di kanan atas, bukan dari sebuah akun, dan id-nya ("admin") bukan
  // uuid. Tanpa penjagaan ini, menyimpan berakhir sebagai keluhan Postgres
  // soal sintaks uuid - benar, tapi tidak menjelaskan apa pun.
  if (demoActive((await cookies()).get(DEMO_COOKIE)?.value)) {
    return {
      ok: false,
      error: "Mode Demo tidak memakai akun sungguhan, jadi tidak ada informasi akun yang bisa disimpan.",
    };
  }
  const user = await getCurrentUser();
  if (user.role === "guest") {
    return { ok: false, error: "Sesi Tamu tidak punya akun yang bisa diubah." };
  }
  const v = parse(myProfileSchema, input);
  if (!v.ok) return v;

  try {
    await updateMyProfile(user.id, { name: v.data.name, avatar: v.data.avatar });
  } catch (e) {
    return errMsg(e, "Gagal menyimpan perubahan akun.");
  }
  // The name and avatar are drawn by the app shell on every route (topbar,
  // sidebar), so a narrower scope would leave the old name on screen
  // everywhere except the page that changed it.
  revalidatePath("/", "layout");
  return { ok: true };
}
