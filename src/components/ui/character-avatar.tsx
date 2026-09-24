import { cn } from "@/lib/utils";

// ============================================================
// Lima karakter foto profil.
//
// SVG INLINE, bukan berkas gambar. Lima file PNG berarti lima permintaan
// jaringan untuk sesuatu sebesar 40 piksel yang muncul di topbar setiap
// halaman, dan tidak ada satupun yang bisa mengikuti tema gelap. Digambar
// sebagai SVG, avatarnya ikut kerangka warnanya sendiri, tajam di layar
// resolusi berapa pun, dan tidak menambah satu permintaan pun.
//
// Warnanya SENGAJA dipatok, bukan memakai token tema: sebuah wajah yang
// berubah warna saat tema diganti tidak lagi terbaca sebagai "orang yang
// sama". Yang ikut tema hanya cincin di luarnya, lewat kelas dari pemanggil.
//
// KUNCINYA DISIMPAN DI DATABASE (profiles.avatar), jadi menambah atau
// mengganti nama kunci berarti avatar seseorang berubah diam-diam. Tambah
// kunci baru; jangan pakai ulang yang lama untuk gambar yang berbeda.
// ============================================================

export const CHARACTER_KEYS = ["rubah", "panda", "burung", "kucing", "beruang"] as const;
export type CharacterKey = (typeof CHARACTER_KEYS)[number];

/** Nama yang dibacakan pembaca layar dan dipakai sebagai label pilihan. */
export const CHARACTER_LABEL: Record<CharacterKey, string> = {
  rubah: "Rubah",
  panda: "Panda",
  burung: "Burung",
  kucing: "Kucing",
  beruang: "Beruang",
};

export const isCharacterKey = (v: unknown): v is CharacterKey =>
  typeof v === "string" && (CHARACTER_KEYS as readonly string[]).includes(v);

/** Latar bulat tiap karakter, dipakai juga sebagai warna petak pemilihnya. */
const BG: Record<CharacterKey, string> = {
  rubah: "#fb923c",
  panda: "#94a3b8",
  burung: "#38bdf8",
  kucing: "#f472b6",
  beruang: "#a78bfa",
};

/**
 * Isi tiap karakter, digambar di kanvas 64x64 di atas lingkaran penuh.
 *
 * Sengaja sederhana: pada 28 piksel di topbar, detail halus berubah jadi
 * bubur. Yang harus bertahan cuma siluetnya - telinga dan warna - karena itu
 * yang membuat lima karakter ini bisa dibedakan sekilas.
 */
const FACES: Record<CharacterKey, React.ReactNode> = {
  rubah: (
    <>
      <path d="M14 24 L20 10 L30 20 Z" fill="#c2410c" />
      <path d="M50 24 L44 10 L34 20 Z" fill="#c2410c" />
      <circle cx="32" cy="36" r="18" fill="#fdba74" />
      <path d="M32 54 a18 18 0 0 1 -16 -10 h32 a18 18 0 0 1 -16 10 z" fill="#fff7ed" />
      <circle cx="25" cy="33" r="3" fill="#7c2d12" />
      <circle cx="39" cy="33" r="3" fill="#7c2d12" />
      <path d="M32 40 l-4 4 h8 z" fill="#7c2d12" />
    </>
  ),
  panda: (
    <>
      <circle cx="17" cy="18" r="8" fill="#1f2937" />
      <circle cx="47" cy="18" r="8" fill="#1f2937" />
      <circle cx="32" cy="36" r="19" fill="#f8fafc" />
      <ellipse cx="24" cy="33" rx="6" ry="7" fill="#1f2937" />
      <ellipse cx="40" cy="33" rx="6" ry="7" fill="#1f2937" />
      <circle cx="24" cy="33" r="2.2" fill="#f8fafc" />
      <circle cx="40" cy="33" r="2.2" fill="#f8fafc" />
      <ellipse cx="32" cy="43" rx="4" ry="3" fill="#1f2937" />
    </>
  ),
  burung: (
    <>
      <circle cx="32" cy="34" r="19" fill="#bae6fd" />
      <path d="M32 12 q4 -6 8 -2 q-4 2 -4 6 z" fill="#0ea5e9" />
      <circle cx="25" cy="31" r="3.2" fill="#0c4a6e" />
      <circle cx="39" cy="31" r="3.2" fill="#0c4a6e" />
      <path d="M32 37 l-6 4 l6 4 l6 -4 z" fill="#fbbf24" />
      <path d="M13 36 q6 6 12 4" stroke="#7dd3fc" strokeWidth="4" fill="none" strokeLinecap="round" />
    </>
  ),
  kucing: (
    <>
      <path d="M15 26 L18 9 L31 19 Z" fill="#f9a8d4" />
      <path d="M49 26 L46 9 L33 19 Z" fill="#f9a8d4" />
      <circle cx="32" cy="36" r="18" fill="#fbcfe8" />
      <circle cx="25" cy="34" r="3" fill="#831843" />
      <circle cx="39" cy="34" r="3" fill="#831843" />
      <path d="M32 41 l-3 3 h6 z" fill="#831843" />
      <path d="M12 38 h9 M12 43 h9 M43 38 h9 M43 43 h9" stroke="#f472b6" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  beruang: (
    <>
      <circle cx="16" cy="20" r="9" fill="#7c3aed" />
      <circle cx="48" cy="20" r="9" fill="#7c3aed" />
      <circle cx="16" cy="20" r="4.5" fill="#ddd6fe" />
      <circle cx="48" cy="20" r="4.5" fill="#ddd6fe" />
      <circle cx="32" cy="37" r="19" fill="#c4b5fd" />
      <ellipse cx="32" cy="44" rx="9" ry="7" fill="#ede9fe" />
      <circle cx="25" cy="33" r="3" fill="#312e81" />
      <circle cx="39" cy="33" r="3" fill="#312e81" />
      <ellipse cx="32" cy="41" rx="3.5" ry="2.5" fill="#312e81" />
    </>
  ),
};

/**
 * One character, sized like `Avatar` so the two are interchangeable.
 *
 * `title` is rendered inside the SVG rather than as an `aria-label` on a
 * `<span>`: an image needs its name IN the accessibility tree, and a bare
 * decorative circle beside a name that is already written out would just be
 * read twice.
 */
export function CharacterAvatar({
  character,
  size = 32,
  className,
  title,
}: {
  character: CharacterKey;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      className={cn("shrink-0 rounded-full", className)}
      style={{ backgroundColor: BG[character] }}
    >
      {title && <title>{title}</title>}
      {FACES[character]}
    </svg>
  );
}

/** The swatch colour behind a character, for the picker's selected ring. */
export const characterColor = (c: CharacterKey) => BG[c];
