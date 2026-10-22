"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Archive,
  CloseCircle,
  Copy,
  CopySuccess,
  Document,
  DocumentCode,
  DocumentText,
  Gallery,
  Link21,
  Music,
  TickCircle,
  VideoPlay,
  Warning2,
  type Icon,
} from "iconsax-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

export type UploadItem = {
  id: string;
  file: File;
  status: "uploading" | "done" | "error";
  percent: number;
  shareUrl: string;
  error?: string;
};

function iconFor(file: File): Icon {
  const type = file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (type.startsWith("image/")) return Gallery;
  if (type.startsWith("video/")) return VideoPlay;
  if (type.startsWith("audio/")) return Music;
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return Archive;
  if (["js", "ts", "tsx", "json", "html", "css", "py", "go", "rs", "sh"].includes(ext)) return DocumentCode;
  if (type.startsWith("text/") || ["pdf", "doc", "docx", "md", "txt", "rtf"].includes(ext)) return DocumentText;
  return Document;
}

export function FileRow({ item, onRemove }: { item: UploadItem; onRemove: () => void }) {
  const FileIcon = iconFor(item.file);
  const loaded = Math.round((item.file.size * item.percent) / 100);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={cn(
        "overflow-hidden rounded-xl border bg-card p-3 shadow-xs",
        item.status === "error" && "border-danger/30 bg-danger-subtle",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-lg border bg-surface transition-colors",
              item.status === "uploading" && "text-brand-muted",
              item.status === "done" && "text-foreground",
              item.status === "error" && "border-danger/30 text-danger-muted",
            )}
          >
            <FileIcon variant="Bulk" className="size-5" color="currentColor" />
          </div>
          <AnimatePresence>
            {item.status === "done" && (
              <motion.span
                key="done"
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
                className="absolute -right-1.5 -bottom-1.5 flex rounded-full bg-card text-success"
              >
                <TickCircle variant="Bold" className="size-4.5" color="currentColor" />
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-medium">{item.file.name}</span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
              {item.status === "uploading" ? `${Math.floor(item.percent)}%` : formatBytes(item.file.size)}
            </span>
          </div>
          <StatusLine item={item} loaded={loaded} />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`${item.status === "uploading" ? "Cancel" : "Remove"} ${item.file.name}`}
              onClick={onRemove}
              className="text-muted-foreground"
            >
              <CloseCircle className="size-4" color="currentColor" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{item.status === "uploading" ? "Cancel" : "Remove"}</TooltipContent>
        </Tooltip>
      </div>

      {item.status === "uploading" && (
        <Progress
          value={item.percent}
          aria-label={`Uploading ${item.file.name}`}
          className="mt-3 h-1 *:data-[slot=progress-indicator]:bg-brand *:data-[slot=progress-indicator]:duration-150"
        />
      )}

      <AnimatePresence initial={false}>
        {item.status === "done" && (
          <motion.div
            key="share"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <ShareLink url={item.shareUrl} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function StatusLine({ item, loaded }: { item: UploadItem; loaded: number }) {
  if (item.status === "uploading") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span aria-hidden className="dot-running size-1.5 rounded-full" />
        <span className="text-shimmer-brand font-medium">Uploading</span>
        <span className="font-mono tabular-nums">
          {formatBytes(loaded)} of {formatBytes(item.file.size)}
        </span>
      </span>
    );
  }
  if (item.status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-danger-muted">
        <Warning2 className="size-3.5 shrink-0" color="currentColor" />
        {item.error}
      </span>
    );
  }
  return <span className="text-xs font-medium text-success-muted">Ready to share</span>;
}

function ShareLink({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied", { description: "Anyone with the link can download the file." });
    } catch {
      toast.error("Couldn't copy the link", { description: "Select it and copy it manually." });
    }
  };

  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border bg-surface py-1 pr-1 pl-2.5">
      <Link21 className="size-4 shrink-0 text-brand-muted" color="currentColor" />
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground select-all">
        {url.replace(/^https?:\/\//, "")}
      </span>
      <Button type="button" size="sm" variant={copied ? "secondary" : "default"} onClick={copy} className="min-w-24">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={copied ? "copied" : "copy"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="inline-flex items-center gap-1.5"
          >
            {copied ? (
              <>
                <CopySuccess className="size-3.5 text-success" color="currentColor" /> Copied
              </>
            ) : (
              <>
                <Copy className="size-3.5" color="currentColor" /> Copy link
              </>
            )}
          </motion.span>
        </AnimatePresence>
      </Button>
    </div>
  );
}
