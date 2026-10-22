import { cn } from "@/lib/utils";

/**
 * Dropwave logomark: a drop falling onto a wave. Same construction as the
 * Dispatch mark (violet tile, foreground shapes at stepped opacities).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <path d="M16 6.5c2.6 3.3 4 5.6 4 7.4a4 4 0 1 1-8 0c0-1.8 1.4-4.1 4-7.4Z" className="fill-brand-foreground" />
      <path
        d="M6 21.5c2.2 0 2.2-1.6 4.4-1.6s2.2 1.6 4.4 1.6 2.2-1.6 4.4-1.6 2.2 1.6 4.4 1.6 2.2-1.6 2.4-1.6"
        className="stroke-brand-foreground"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        strokeOpacity="0.85"
      />
      <path
        d="M8 25.5c1.9 0 1.9-1.3 3.8-1.3s1.9 1.3 3.8 1.3 1.9-1.3 3.8-1.3 1.9 1.3 3.8 1.3"
        className="stroke-brand-foreground"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        strokeOpacity="0.45"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="font-heading text-[17px] font-medium tracking-[-0.03em] text-foreground">Dropwave</span>
    </span>
  );
}
