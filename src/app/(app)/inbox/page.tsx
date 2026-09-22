import { requireModule } from "@/lib/guard";
import { can } from "@/lib/permissions";
import {
  getAccounts, getBroadcastRecipientIds, getBroadcasts, getInbox,
} from "@/lib/data/repo";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InboxView } from "@/components/inbox/inbox-view";
import { BroadcastManager } from "@/components/inbox/broadcast-composer";

export const metadata = { title: "Kotak Masuk" };

export default async function InboxPage() {
  const user = await requireModule("inbox");
  const t = await getT();
  const isAdmin = can.manageBroadcasts(user);

  // No guest branch below: `requireModule("inbox")` already turned them away,
  // because MODULE_ACCESS_LEVEL gives Tamu "none" here. A shared anonymous
  // session has no account for an inbox to belong to.
  const messages = await getInbox(user.id);

  if (!isAdmin) {
    return (
      <div className="space-y-5">
        <PageHeader
          title={t("Kotak Masuk")}
          description={t("Pengumuman dan siaran dari admin.")}
        />
        <InboxView messages={messages} />
      </div>
    );
  }

  // Admin also gets the sending side. Recipient ids come along so the edit
  // form can re-open with the right accounts already ticked.
  const [broadcasts, accounts] = await Promise.all([getBroadcasts(), getAccounts()]);
  const entries = await Promise.all(
    broadcasts
      .filter((b) => b.audience === "accounts")
      .map(async (b) => [b.id, await getBroadcastRecipientIds(b.id)] as const),
  );
  const recipientsById = Object.fromEntries(entries);
  const unread = messages.filter((m) => !m.read_at).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("Kotak Masuk")}
        description={t("Baca siaran yang masuk, dan kirim pengumuman ke akun lain.")}
      />
      <Tabs defaultValue={unread > 0 ? "masuk" : "siaran"}>
        <TabsList>
          <TabsTrigger value="masuk">
            {t("Pesan Masuk")}{unread > 0 ? ` (${unread})` : ""}
          </TabsTrigger>
          <TabsTrigger value="siaran">{t("Kelola Siaran")}</TabsTrigger>
        </TabsList>
        <TabsContent value="masuk">
          <InboxView messages={messages} />
        </TabsContent>
        <TabsContent value="siaran">
          {accounts.length === 0 && (
            <Card className="mb-3 border-amber-300/60 bg-amber-50/60 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
              {t("Belum ada akun terdaftar yang bisa dikirimi siaran. Di Mode Demo memang tidak ada akun sungguhan, jadi daftar ini selalu kosong.")}
            </Card>
          )}
          <BroadcastManager
            broadcasts={broadcasts}
            accounts={accounts}
            recipientsById={recipientsById}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
