import { LegalDocument } from "@/components/legal/legal-document";
import { TERMS } from "@/lib/legal";
import { getLang } from "@/lib/i18n/server";

export const metadata = {
  title: "Ketentuan Layanan",
  description: "Ketentuan pemakaian Ormawa Visit Management System.",
};

export default async function TermsPage() {
  return <LegalDocument doc={TERMS} lang={await getLang()} />;
}
