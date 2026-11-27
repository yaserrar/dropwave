import { Heart } from "iconsax-react";
import { LogoMark } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-4 pt-2 pb-8 sm:px-6">
      <div aria-hidden className="mx-auto mb-6 h-px max-w-xs bg-linear-to-r from-transparent via-brand-border to-transparent" />
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-heading font-medium tracking-[-0.02em] text-foreground">
          <LogoMark className="size-4" />
          Dropwave
        </span>
        <span aria-hidden className="text-brand-border">·</span>
        <span className="group inline-flex items-center gap-1">
          made with care
          <Heart
            variant="Bold"
            color="currentColor"
            aria-hidden
            className="size-3.5 text-brand transition-transform group-hover:scale-125"
          />
        </span>
        <span aria-hidden className="text-brand-border">·</span>
        <span>
          by <span className="text-dia font-medium">asrar</span>
        </span>
      </p>
    </footer>
  );
}
