import { ShareLanding } from "@/components/share/share-landing";
import { ALL_NAV_ITEMS } from "@/components/layout/nav-config";
import { getT } from "@/lib/i18n/server";
import { SHARE_QUERY_KEYS, isShareModule } from "@/lib/share";

export const metadata = { title: "Tautan bagikan" };

// Public (see proxy.ts): opening a share link must not require an account.
// Everything that needs a session happens in ShareLanding, in the browser.
export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ event: string; module: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ event, module }, sp, t] = await Promise.all([params, searchParams, getT()]);
  const item = ALL_NAV_ITEMS.find((i) => i.key === module);
  const query: Record<string, string> = {};
  for (const k of SHARE_QUERY_KEYS) {
    const v = sp[k];
    if (typeof v === "string") query[k] = v;
  }
  return (
    <ShareLanding
      event={decodeURIComponent(event)}
      module={isShareModule(module) ? module : ""}
      moduleLabel={item ? t(item.label) : t("halaman")}
      demo={sp.demo === "1"}
      query={query}
    />
  );
}
