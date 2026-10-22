"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Danger, DocumentUpload, Refresh2, SearchStatus, Timer1, type Icon } from "iconsax-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UnavailableReason = "not-found" | "expired" | "error";

const COPY: Record<UnavailableReason, { icon: Icon; tone: string; title: string; body: string }> = {
  "not-found": {
    icon: SearchStatus,
    tone: "bg-muted text-muted-foreground",
    title: "This file isn't here",
    body: "The link may be mistyped, the file may have been removed, or its upload never finished.",
  },
  expired: {
    icon: Timer1,
    tone: "bg-warning-subtle text-warning-muted",
    title: "This link has expired",
    body: "Shared files are only kept for a limited time. Ask the sender to upload it again.",
  },
  error: {
    icon: Danger,
    tone: "bg-danger-subtle text-danger-muted",
    title: "Couldn't load this file",
    body: "Something went wrong on our side or with your connection. Try again in a moment.",
  },
};

export function SharedFileUnavailable({ reason, onRetry }: { reason: UnavailableReason; onRetry?: () => void }) {
  const { icon: StateIcon, tone, title, body } = COPY[reason];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="frame-double"
      role="alert"
    >
      <div className="relative isolate flex flex-col items-center overflow-hidden rounded-[13px] border bg-card px-6 py-10 text-center sm:px-10">
        <div aria-hidden className="bg-dot-grid mask-radial pointer-events-none absolute inset-0 opacity-60" />

        <motion.div
          initial={{ rotate: -8, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.1 }}
          className={cn("relative flex size-16 items-center justify-center rounded-2xl border", tone)}
        >
          <StateIcon variant="Bulk" className="size-8" color="currentColor" />
        </motion.div>

        <h1 className="relative mt-6 font-heading text-xl font-medium tracking-tight">{title}</h1>
        <p className="relative mt-2 max-w-sm text-sm leading-relaxed text-pretty text-muted-foreground">{body}</p>

        <div className="relative mt-8 flex flex-wrap justify-center gap-2">
          {reason === "error" && onRetry && (
            <Button variant="outline" size="lg" onClick={onRetry}>
              <Refresh2 className="size-4" color="currentColor" />
              Try again
            </Button>
          )}
          <Button asChild size="lg" className="bg-brand text-brand-foreground hover:bg-brand-hover">
            <Link href="/">
              <DocumentUpload className="size-4" color="currentColor" />
              Share your own file
            </Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
