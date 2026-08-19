import { requireDeveloper } from "@/lib/guard";
import { developerCount } from "@/lib/developers";
import {
  developerRegistered, getAccessCounts, getActivity, getActorStats, getErrors, getPresence,
  getTableCounts,
} from "@/lib/data/developer-repo";
import { USE_SUPABASE } from "@/lib/auth";
import { demoConfigured } from "@/lib/demo";
import { violetConfigured } from "@/lib/violet/llm";
import { APP_VERSION } from "@/lib/version";
import { DeveloperView } from "@/components/developer/developer-view";

// ============================================================
// The hidden Developer menu.
//
// Not in NAV, so it is absent from the sidebar, the global search palette and
// the Settings access matrix, all three of which are generated from it. Not in
// GUIDE, so the Panduan does not document it. Not in APP_ROUTES, so Violet can
// neither link to it nor describe it, and `resolveHref` drops the path as
// unknown if the model ever invents it. Not in MODULE_ACCESS_LEVEL, so no role
// can be granted it.
//
// The single entry point is one item in the account menu, rendered only when
// the signed-in address is on the allowlist. Everyone else gets a 404 here -
// notFound(), not a redirect, because a redirect would confirm the route exists.
// ============================================================

export const metadata = {
  title: "Developer",
  // Belt and braces: the route already 404s for anyone who is not on the list,
  // but a crawler that somehow reaches it should not index it either.
  robots: { index: false, follow: false },
};

/** Always fresh. A cached audit trail is a misleading audit trail. */
export const dynamic = "force-dynamic";

export default async function DeveloperPage() {
  const user = await requireDeveloper();

  const [registered, activity, actors, presence, errors, counts, access] = await Promise.all([
    developerRegistered(),
    getActivity(),
    getActorStats(),
    getPresence(120),
    getErrors(),
    getTableCounts(),
    getAccessCounts(),
  ]);

  // Which services are wired up. Presence of a key, NEVER its value: this page
  // is the one place in the app where it would be tempting to print secrets,
  // and a screen-share or a screenshot is all it takes.
  const env = [
    { key: "Supabase (produksi)", set: !!process.env.NEXT_PUBLIC_SUPABASE_URL },
    { key: "Supabase (demo)", set: demoConfigured() },
    { key: "Gemini (Violet)", set: !!process.env.GEMINI_API_KEY },
    { key: "Groq (Violet cadangan)", set: !!process.env.GROQ_API_KEY },
    { key: "Violet aktif", set: violetConfigured() },
    { key: "Mode data", set: USE_SUPABASE, note: USE_SUPABASE ? "Supabase" : "JSON lokal" },
  ];

  const build = {
    version: APP_VERSION,
    node: process.version,
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7),
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? "",
    commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? "",
    serverTime: new Date().toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    developerCount: developerCount(),
  };

  return (
    <DeveloperView
      me={user}
      registered={registered}
      activity={activity}
      actors={actors}
      presence={presence}
      errors={errors}
      counts={counts}
      access={access}
      env={env}
      build={build}
    />
  );
}
