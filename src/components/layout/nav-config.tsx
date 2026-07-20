import {
  LayoutDashboard,
  ListChecks,
  CalendarDays,
  Clock,
  ClipboardList,
  Target,
  Link2,
  Wallet,
  Users,
  CalendarRange,
  HelpCircle,
  BookOpen,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    group: "Utama",
    items: [
      {
        key: "dashboard",
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "Ringkasan progres & metrik Ormawa Visit",
      },
    ],
  },
  {
    group: "Operasional",
    items: [
      {
        key: "tasks",
        label: "Work Breakdown",
        href: "/tasks",
        icon: ListChecks,
        description: "Semua tugas: tabel, kanban & timeline",
      },
      {
        key: "calendar",
        label: "Kalender",
        href: "/calendar",
        icon: CalendarDays,
        description: "Deadline & agenda dalam tampilan kalender",
      },
      {
        key: "rundown",
        label: "Rundown",
        href: "/rundown",
        icon: Clock,
        description: "Susunan acara hari pelaksanaan",
      },
      {
        key: "jobs",
        label: "Hari-H",
        href: "/jobs",
        icon: ClipboardList,
        description: "Pembagian tugas panitia saat hari pelaksanaan",
      },
    ],
  },
  {
    group: "Relasi & Aset",
    items: [
      {
        key: "prospects",
        label: "Reach & Offer",
        href: "/prospects",
        icon: Target,
        description: "Data & alur himpunan yang dihubungi",
      },
      {
        key: "links",
        label: "Super Link",
        href: "/links",
        icon: Link2,
        description: "Kumpulan dokumen & tautan penting",
      },
      {
        key: "budget",
        label: "Anggaran",
        href: "/budget",
        icon: Wallet,
        description: "Rencana anggaran biaya & skenario min/maks",
      },
    ],
  },
  {
    group: "Organisasi",
    items: [
      {
        key: "members",
        label: "Divisi & Anggota",
        href: "/members",
        icon: Users,
        description: "Divisi, anggota, & struktur tim tiap Ormawa Visit",
      },
      {
        key: "events",
        label: "Ormawa Visit",
        href: "/events",
        icon: CalendarRange,
        description: "Kelola daftar Ormawa Visit",
      },
      {
        key: "faq",
        label: "FAQ",
        href: "/faq",
        icon: HelpCircle,
        description: "Pertanyaan umum seputar Ormawa Visit",
      },
      {
        key: "panduan",
        label: "Panduan",
        href: "/panduan",
        icon: BookOpen,
        description: "Alur penggunaan website dari awal sampai akhir",
      },
      {
        key: "settings",
        label: "Pengaturan",
        href: "/settings",
        icon: Settings,
        description: "Konfigurasi sistem & manajemen data",
      },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV.flatMap((g) => g.items);

export function navItemForPath(pathname: string): NavItem | undefined {
  const seg = "/" + (pathname.split("/")[1] ?? "");
  // Division boards (/divisions/[key]) live under the merged "Divisi & Anggota".
  const resolved = seg === "/divisions" ? "/members" : seg;
  return ALL_NAV_ITEMS.find((i) => i.href === resolved);
}
