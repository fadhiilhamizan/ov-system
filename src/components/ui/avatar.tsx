import { cn } from "@/lib/utils";
import { initials, stringToHue } from "@/lib/utils";
import { CharacterAvatar, isCharacterKey } from "./character-avatar";

/**
 * Seseorang, digambar sekecil apa pun tempatnya.
 *
 * Dua bentuk, satu komponen: karakter pilihan kalau ada, inisial namanya kalau
 * tidak. Percabangannya sengaja di SINI dan bukan di tiap pemanggil - avatar
 * dipasang di belasan tempat (topbar, komentar tugas, pemilih PIC, kotak
 * masuk), dan "sebagian ikut pilihan karakternya, sebagian tidak" adalah
 * bentuk bug yang hanya ketahuan satu layar pada satu waktu.
 */
export function Avatar({
  name,
  color,
  character,
  className,
  size = 32,
}: {
  name: string;
  color?: string;
  /** Kunci karakter pilihan pengguna. Apa pun yang tidak dikenal diabaikan. */
  character?: string | null;
  className?: string;
  size?: number;
}) {
  if (isCharacterKey(character)) {
    return <CharacterAvatar character={character} size={size} className={className} title={name} />;
  }
  const bg = color ?? `hsl(${stringToHue(name)} 60% 55%)`;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        className,
      )}
      style={{ backgroundColor: bg, width: size, height: size, fontSize: size * 0.38 }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
