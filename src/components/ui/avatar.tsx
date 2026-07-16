import { cn } from "@/lib/utils";
import { initials, stringToHue } from "@/lib/utils";

export function Avatar({
  name,
  color,
  className,
  size = 32,
}: {
  name: string;
  color?: string;
  className?: string;
  size?: number;
}) {
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
