"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Copy,
  CopySuccess,
  ImportCurve,
  Lock,
  ShieldTick,
  Sms,
  TickCircle,
  Timer1,
  Trash,
  type Icon,
} from "iconsax-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ShareByEmail } from "./share-by-email";

const DAY_MS = 24 * 3600 * 1000;

// Entrance of a share card: its parts rise in one after the other.
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
export const rise = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/** The card around a share-page state, entering with a small spring. */
export function ShareCardFrame({ children, role }: { children: React.ReactNode; role?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="frame-double"
      role={role}
    >
      <div className="relative isolate overflow-hidden rounded-[13px] border bg-card">
        <div
          aria-hidden
          className="bg-dot-grid pointer-events-none absolute inset-x-0 top-0 h-48 opacity-70 mask-[radial-gradient(ellipse_70%_100%_at_50%_0%,black,transparent_80%)]"
        />
        {children}
      </div>
    </motion.div>
  );
}

/** Icon on a raised tile, with slow waves rolling out behind it. */
export function IconTile({ icon: TileIcon }: { icon: Icon }) {
  return (
    <div className="relative">
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-3xl border border-brand/40"
          animate={{ scale: [1, 1.9], opacity: [0.5, 0] }}
          transition={{
            duration: 3,
            repeat: Infinity,
            delay: i * 1.5,
            ease: "easeOut",
          }}
        />
      ))}
      <div aria-hidden className="absolute inset-2 rounded-full bg-brand/30 blur-xl" />
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        className="relative flex size-20 items-center justify-center rounded-3xl border bg-card text-brand-muted shadow-lg"
      >
        <TileIcon variant="Bulk" className="size-10" color="currentColor" />
      </motion.div>
    </div>
  );
}

/** What the link does: expiry, password, one download. Nothing when none apply. */
export function LinkFacts({
  expiresAt,
  isProtected,
  burnAfterDownload,
}: {
  expiresAt: string | null;
  isProtected: boolean;
  burnAfterDownload: boolean;
}) {
  if (!expiresAt && !isProtected && !burnAfterDownload) return null;
  const expiresSoon = expiresAt ? new Date(expiresAt).getTime() - Date.now() < DAY_MS : false;
  const fact = "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs";

  return (
    <motion.div variants={rise} className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
      {expiresAt && (
        <span className={cn(fact, expiresSoon ? "bg-warning-subtle text-warning-muted" : "text-muted-foreground")}>
          <Timer1 variant="Bulk" className="size-3.5" color="currentColor" />
          Link expires {formatRelativeTime(expiresAt)}
        </span>
      )}
      {isProtected && (
        <span className={cn(fact, "text-muted-foreground")}>
          <Lock variant="Bulk" className="size-3.5" color="currentColor" />
          Password protected
        </span>
      )}
      {burnAfterDownload && (
        <span className={cn(fact, "bg-warning-subtle text-warning-muted")}>
          <Trash variant="Bulk" className="size-3.5" color="currentColor" />
          One download only
        </span>
      )}
    </motion.div>
  );
}

/**
 * The main download link. The API redirects to a short-lived S3 URL (one file) or
 * streams a zip (all files), both served as attachments, so the page stays put.
 *
 * `beforeDownload` runs first when set (burn-after-download links): it checks the
 * link still works, so a used link shows the share page's message instead of
 * navigating to an error. `used` then keeps the button off for good.
 */
export function DownloadButton({
  href,
  label,
  ready,
  used = false,
  beforeDownload,
}: {
  href: string;
  label: string;
  /** False while files are still being checked. */
  ready: boolean;
  used?: boolean;
  beforeDownload?: () => Promise<boolean>;
}) {
  const [started, setStarted] = React.useState(false);
  const enabled = ready && !used;

  React.useEffect(() => {
    if (!started) return;
    const timer = setTimeout(() => setStarted(false), 2500);
    return () => clearTimeout(timer);
  }, [started]);

  const onClick = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!enabled) {
      event.preventDefault();
      return;
    }
    if (!beforeDownload) {
      setStarted(true);
      return;
    }
    event.preventDefault();
    if (await beforeDownload()) {
      setStarted(true);
      window.location.assign(href);
    }
  };

  return (
    <Button
      asChild
      size="lg"
      className={cn(
        "group/download h-11 min-w-0 flex-1 rounded-lg bg-brand text-sm text-brand-foreground shadow-md hover:bg-brand-hover",
        !enabled && "cursor-not-allowed opacity-50",
      )}
    >
      <a href={enabled ? href : undefined} onClick={onClick} role="link" aria-disabled={!enabled}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={started ? "started" : used ? "used" : "idle"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="inline-flex min-w-0 items-center gap-2"
          >
            {started || used ? (
              <>
                <TickCircle variant="Bold" className="size-4.5 shrink-0" color="currentColor" />
                {started ? "Download started" : "Downloaded"}
              </>
            ) : (
              <>
                <ImportCurve
                  className="size-4.5 shrink-0 transition-transform duration-300 group-hover/download:translate-y-0.5"
                  color="currentColor"
                />
                <span className="truncate">{label}</span>
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </a>
    </Button>
  );
}

export function CopyLinkButton() {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link", {
        description: "Copy it from the address bar instead.",
      });
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          className="size-11 rounded-lg"
          aria-label="Copy link"
          onClick={copy}
        >
          {copied ? (
            <CopySuccess className="size-4.5 text-success" color="currentColor" />
          ) : (
            <Copy className="size-4.5" color="currentColor" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{copied ? "Copied" : "Copy link"}</TooltipContent>
    </Tooltip>
  );
}

/**
 * "Send to someone by email", opening the address field under it. A text button
 * under the actions rather than another icon beside them: that row has no room
 * left on a phone, and downloading stays the main action.
 */
export function EmailShare({
  dropId,
  isProtected,
  disabled,
}: {
  dropId: string;
  isProtected: boolean;
  /** The API only emails links whose files passed the check, like it only serves them. */
  disabled: boolean;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <motion.div variants={rise} className="mt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(!open && "text-muted-foreground")}
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((value) => !value)}
        >
          <Sms className="size-3.5" color="currentColor" />
          Send to someone by email
        </Button>
      </motion.div>

      <AnimatePresence initial={false}>
        {open && !disabled && (
          <motion.div
            key="email"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            // The padding, offset by the negative margin, leaves room for the input's focus ring.
            className="-mx-1 -mb-1 self-stretch overflow-hidden px-1 pb-1"
          >
            <ShareByEmail dropId={dropId} protected={isProtected} size="lg" onSent={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function PrivacyFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex items-center justify-center gap-1.5 border-t bg-surface/60 px-6 py-3 text-center text-xs text-muted-foreground">
      <ShieldTick className="size-3.5 shrink-0 text-success-muted" color="currentColor" />
      {children}
    </div>
  );
}

/** Shown under the actions of a burn-after-download link: before, and after its one download. */
export function BurnNotice({ used, many }: { used: boolean; many: boolean }) {
  return (
    <motion.p
      variants={rise}
      role={used ? "status" : undefined}
      className="mt-4 rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2 text-left text-xs leading-relaxed text-pretty text-warning-muted"
    >
      {used
        ? "This link has now been used. Its files are deleted in a minute and the link stops working."
        : many
          ? "This link works for one download: the files come as one zip, then they're deleted. Previews are off, so nothing is fetched before."
          : "This link works for one download, then the file is deleted. Previews are off, so it's only fetched once."}
    </motion.p>
  );
}
