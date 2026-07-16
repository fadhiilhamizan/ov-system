import {
  LayoutDashboard,
  ListChecks,
  LayoutGrid,
  CalendarDays,
  Clock,
  ClipboardList,
  Target,
  Link2,
  Wallet,
  Users,
  CalendarRange,
  HelpCircle,
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
        description: "Seluruh tugas OV — tabel, kanban & timeline",
      },
      {
        key: "divisions",
        label: "Papan Divisi",
        href: "/divisions",
        icon: LayoutGrid,
        description: "Tampilan tugas tersaring per divisi (mirroring)",
      },
      {
        key: "calendar",
        label: "Kalender",
        href: "/calendar",
        icon: CalendarDays,
        description: "Deadline & milestone dalam tampilan kalender",
      },
      {
        key: "rundown",
        label: "Rundown Acara",
        href: "/rundown",
        icon: Clock,
        description: "Juklak-juknis susunan acara hari-H",
      },
      {
        key: "jobs",
        label: "Job Hari-H",
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
        label: "Prospek Himpunan",
        href: "/prospects",
        icon: Target,
        description: "Database & pipeline himpunan target kunjungan",
      },
      {
        key: "links",
        label: "Super Link",
        href: "/links",
        icon: Link2,
        description: "Direktori dokumen & tautan penting per divisi",
      },
      {
        key: "budget",
        label: "Anggaran (RAB)",
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
        label: "Anggota & Tim",
        href: "/members",
        icon: Users,
        description: "Direktori fungsionaris, intern & struktur tim",
      },
      {
        key: "events",
        label: "Edisi OV",
        href: "/events",
        icon: CalendarRange,
        description: "Kelola edisi/gelaran Ormawa Visit",
      },
      {
        key: "faq",
        label: "FAQ & Panduan",
        href: "/faq",
        icon: HelpCircle,
        description: "Pertanyaan umum seputar Ormawa Visit",
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
  return ALL_NAV_ITEMS.find((i) => i.href === seg);
}
