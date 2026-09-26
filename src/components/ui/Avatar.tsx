import Image from "next/image";
import { cn } from "@/lib/utils";

function seedToUrl(seed: string) {
  return `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(seed)}&backgroundType=gradientLinear`;
}

export function Avatar({
  seed,
  src,
  size = 32,
  className,
}: {
  seed: string;
  src?: string;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={src ?? seedToUrl(seed)}
      alt={seed}
      width={size}
      height={size}
      unoptimized={!src || src.startsWith("https://api.dicebear.com")}
      className={cn(
        "rounded-full border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800",
        className,
      )}
    />
  );
}

export function AvatarStack({ seeds, max = 5 }: { seeds: string[]; max?: number }) {
  const shown = seeds.slice(0, max);
  const rest = seeds.length - shown.length;
  const hidden = seeds.slice(max);
  return (
    <div className="flex items-center">
      {shown.map((seed, i) => (
        <Avatar
          key={seed}
          seed={seed}
          size={28}
          className={cn("ring-2 ring-white dark:ring-slate-950", i > 0 && "-ms-2")}
        />
      ))}
      {rest > 0 && (
        <span
          aria-label={`+${rest} more contributors`}
          title={hidden.join(", ")}
          className="-ms-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[11px] font-medium text-slate-600 ring-2 ring-white dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-950"
        >
          +{rest}
        </span>
      )}
    </div>
  );
}
