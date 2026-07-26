import { LegalDocument } from "@/components/legal/legal-document";
import { PRIVACY } from "@/lib/legal";
import { getLang } from "@/lib/i18n/server";

export const metadata = {
  title: "Kebijakan Privasi",
  description: "Data apa yang dikumpulkan Ormawa Visit Management System dan bagaimana data itu dipakai.",
};

export default async function PrivacyPage() {
  return <LegalDocument doc={PRIVACY} lang={await getLang()} />;
}
