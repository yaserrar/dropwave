"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Copy, CopySuccess, ImportCurve, ShieldTick, TickCircle, Timer1 } from "iconsax-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { iconForFile } from "@/lib/file-icons";
import { fileTypeLabel, formatBytes, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FileInfo } from "@/types/file";

const DAY_MS = 24 * 3600 * 1000;

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const rise = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

export function SharedFileCard({ file, downloadUrl }: { file: FileInfo; downloadUrl: string }) {
  const FileIcon = iconForFile(file.filename, file.contentType);
  const expiresSoon = file.expiresAt ? new Date(file.expiresAt).getTime() - Date.now() < DAY_MS : false;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="frame-double"
    >
      <div className="relative isolate overflow-hidden rounded-[13px] border bg-card">
        <div aria-hidden className="bg-dot-grid pointer-events-none absolute inset-x-0 top-0 h-48 opacity-70 mask-[radial-gradient(ellipse_70%_100%_at_50%_0%,black,transparent_80%)]" />

        <motion.div variants={stagger} initial="hidden" animate="show" className="relative flex flex-col items-center px-6 pt-10 pb-6 text-center sm:px-10">
          <motion.div variants={rise}>
            <FileTile icon={FileIcon} />
          </motion.div>

          <motion.span
            variants={rise}
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-brand-subtle px-2.5 py-0.5 text-xs font-medium text-brand-muted"
          >
            Shared with you
          </motion.span>

          <motion.h1
            variants={rise}
            title={file.filename}
            className="mt-3 line-clamp-2 font-heading text-2xl leading-tight font-medium tracking-tight break-all sm:text-[28px]"
          >
            {file.filename}
          </motion.h1>

          <motion.p variants={rise} className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="rounded-sm border bg-muted px-1.5 py-px font-mono text-2xs font-medium text-foreground">
              {fileTypeLabel(file.filename, file.contentType)}
            </span>
            <span className="font-mono tabular-nums">{formatBytes(file.size)}</span>
            <span aria-hidden className="size-1 rounded-full bg-border-strong" />
            <span>Uploaded {formatRelativeTime(file.createdAt)}</span>
          </motion.p>

          {file.expiresAt && (
            <motion.p
              variants={rise}
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
                expiresSoon ? "bg-warning-subtle text-warning-muted" : "text-muted-foreground",
              )}
            >
              <Timer1 className="size-3.5" color="currentColor" />
              Link expires {formatRelativeTime(file.expiresAt)}
            </motion.p>
          )}

          <motion.div variants={rise} className="mt-8 flex w-full gap-2">
            <DownloadButton href={downloadUrl} />
            <CopyLinkButton />
          </motion.div>
        </motion.div>

        <div className="relative flex items-center justify-center gap-1.5 border-t bg-surface/60 px-6 py-3 text-xs text-muted-foreground">
          <ShieldTick className="size-3.5 shrink-0 text-success-muted" color="currentColor" />
          Stored privately · only people with this link can download it
        </div>
      </div>
    </motion.div>
  );
}

/** File icon on a raised tile, with slow waves rolling out behind it. */
function FileTile({ icon: FileIcon }: { icon: ReturnType<typeof iconForFile> }) {
  return (
    <div className="relative">
      {[0, 1].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[22px] border border-brand/40"
          animate={{ scale: [1, 1.9], opacity: [0.5, 0] }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 1.5, ease: "easeOut" }}
        />
      ))}
      <div aria-hidden className="absolute inset-2 rounded-full bg-brand/30 blur-xl" />
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        className="relative flex size-20 items-center justify-center rounded-[22px] border bg-card text-brand-muted shadow-lg"
      >
        <FileIcon variant="Bulk" className="size-10" color="currentColor" />
      </motion.div>
    </div>
  );
}

function DownloadButton({ href }: { href: string }) {
  const [started, setStarted] = React.useState(false);

  React.useEffect(() => {
    if (!started) return;
    const timer = setTimeout(() => setStarted(false), 2500);
    return () => clearTimeout(timer);
  }, [started]);

  return (
    <Button
      asChild
      size="lg"
      className="group/download h-11 flex-1 rounded-lg bg-brand text-sm text-brand-foreground shadow-md hover:bg-brand-hover"
    >
      {/* The API redirects to a short-lived S3 URL that is served as an attachment. */}
      <a href={href} onClick={() => setStarted(true)}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={started ? "started" : "idle"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-2"
          >
            {started ? (
              <>
                <TickCircle variant="Bold" className="size-4.5" color="currentColor" />
                Download started
              </>
            ) : (
              <>
                <ImportCurve className="size-4.5 transition-transform duration-300 group-hover/download:translate-y-0.5" color="currentColor" />
                Download file
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </a>
    </Button>
  );
}

function CopyLinkButton() {
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
      toast.error("Couldn't copy the link", { description: "Copy it from the address bar instead." });
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="icon-lg" className="size-11 rounded-lg" aria-label="Copy link" onClick={copy}>
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

export function SharedFileSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="frame-double"
      aria-busy
      aria-label="Loading file"
    >
      <div className="flex flex-col items-center rounded-[13px] border bg-card px-6 pt-10 pb-6 sm:px-10">
        <div className="size-20 animate-pulse rounded-[22px] bg-muted" />
        <div className="mt-6 h-5 w-28 animate-pulse rounded-full bg-muted" />
        <div className="mt-4 h-7 w-3/4 animate-pulse rounded-md bg-muted" />
        <div className="mt-3 h-4 w-1/2 animate-pulse rounded-md bg-muted" />
        <div className="mt-8 flex w-full gap-2">
          <div className="h-11 flex-1 animate-pulse rounded-lg bg-muted" />
          <div className="size-11 animate-pulse rounded-lg bg-muted" />
        </div>
      </div>
    </motion.div>
  );
}
