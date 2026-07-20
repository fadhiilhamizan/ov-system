import { redirect } from "next/navigation";

// The division list now lives as the "Divisi" tab under /members
// ("Divisi & Anggota"). Individual division boards remain at /divisions/[key].
export default function DivisionsPage() {
  redirect("/members");
}
