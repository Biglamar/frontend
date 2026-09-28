"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

function seedToUrl(seed: string) {
  return `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(seed)}&backgroundType=gradientLinear`;
}

/**
 * Must match next.config.ts's `images.remotePatterns` — the only hosts an
 * avatar `src` is ever allowed to resolve to (#20). Backend `avatarUrl` is
 * typed only as `string | null`, not validated as a safe image URL, so a
 * `javascript:`/`data:` scheme or an unexpected third-party host must be
 * rejected here rather than trusted through to `<Image>`.
 */
const ALLOWED_AVATAR_HOSTS = new Set(["avatars.githubusercontent.com", "api.dicebear.com"]);

function isSafeAvatarUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_AVATAR_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
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
  const fallback = seedToUrl(seed);
  const requested = src && isSafeAvatarUrl(src) ? src : fallback;

  // Falls back to the dicebear identicon on a real load failure (404,
  // unreachable host, ...) in addition to the safety check above. Tracking
  // the specific src that errored — not a plain boolean — means a later
  // render with a *different* `src` prop (e.g. the user updates their GitHub
  // avatar) retries instead of staying stuck on the old fallback, while a
  // repeat failure of the same src stays on the fallback instead of
  // retrying it every render.
  const [erroredSrc, setErroredSrc] = useState<string | null>(null);
  const resolved = erroredSrc === requested ? fallback : requested;

  return (
    <Image
      src={resolved}
      alt={seed}
      width={size}
      height={size}
      unoptimized={resolved.startsWith("https://api.dicebear.com")}
      onError={() => setErroredSrc(requested)}
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
