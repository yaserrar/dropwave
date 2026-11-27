"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowDown2,
  CloseCircle,
  Copy,
  CopySuccess,
  DocumentCopy,
  ExportSquare,
  Folder2,
  Link21,
  Lock,
  Sms,
  TickCircle,
  Timer1,
  Trash,
  Warning2,
} from "iconsax-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ShareByEmail } from "@/components/share/share-by-email";
import type { UploadDrop, UploadFile } from "@/hooks/use-drop-uploads";
import { baseName, dropTitle, folderOf, sharedFolder } from "@/lib/drop-files";
import { iconForFile } from "@/lib/file-icons";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Bytes sent so far and in all, over the files still in the drop (not the ones that failed). */
function progressOf(files: UploadFile[]) {
  const counted = files.filter((file) => file.status !== "error");
  const total = counted.reduce((sum, file) => sum + file.file.size, 0);
  const loaded = counted.reduce((sum, file) => sum + (file.file.size * file.percent) / 100, 0);
  return { total, loaded, percent: total ? (loaded / total) * 100 : 0 };
}

/**
 * One drop on the upload page: a single file looks like it always did; several
 * files or a folder get one card with the list, overall progress and one link.
 */
export function DropRow({
  drop,
  onRemove,
  onRemoveFile,
}: {
  drop: UploadDrop;
  onRemove: () => void;
  onRemoveFile: (fileKey: string) => void;
}) {
  const single = drop.files.length === 1 ? drop.files[0]! : null;
  const { total, loaded, percent } = progressOf(drop.files);
  const uploading = drop.status === "uploading";

  const paths = drop.files.map((file) => file.path);
  const folder = sharedFolder(paths);
  const DropIcon = single ? iconForFile(single.file.name, single.file.type) : folder ? Folder2 : DocumentCopy;
  const title = single ? baseName(single.path) : dropTitle(paths);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={cn(
        "overflow-hidden rounded-xl border bg-card p-3 shadow-xs",
        drop.status === "error" && "border-danger/30 bg-danger-subtle",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-lg border bg-surface transition-colors",
              uploading && "text-brand-muted",
              drop.status === "done" && "text-foreground",
              drop.status === "error" && "border-danger/30 text-danger-muted",
            )}
          >
            <DropIcon variant="Bulk" className="size-5" color="currentColor" />
          </div>
          <AnimatePresence>
            {drop.status === "done" && (
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
            <span className="truncate text-sm font-medium" title={single?.path}>
              {title}
            </span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
              {uploading ? `${Math.floor(percent)}%` : formatBytes(total || drop.files[0]!.file.size)}
            </span>
          </div>
          <StatusLine drop={drop} loaded={loaded} total={total} />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`${uploading ? "Cancel" : "Remove"} ${title}`}
              onClick={onRemove}
              className="text-muted-foreground"
            >
              <CloseCircle variant="Bulk" className="size-4" color="currentColor" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{uploading ? "Cancel" : "Remove"}</TooltipContent>
        </Tooltip>
      </div>

      {uploading && (
        <Progress
          value={percent}
          aria-label={`Uploading ${title}`}
          className="mt-3 h-1 *:data-[slot=progress-indicator]:bg-brand *:data-[slot=progress-indicator]:duration-150"
        />
      )}

      {!single && <FileList drop={drop} onRemoveFile={onRemoveFile} />}

      <AnimatePresence initial={false}>
        {drop.status === "done" && (
          <motion.div
            key="share"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <SharePanel drop={drop} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function StatusLine({ drop, loaded, total }: { drop: UploadDrop; loaded: number; total: number }) {
  if (drop.status === "uploading") {
    const count = drop.files.filter((file) => file.status !== "error").length;
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <span aria-hidden className="dot-running size-1.5 shrink-0 rounded-full" />
        <span className="text-shimmer-brand font-medium">Uploading</span>
        <span className="truncate font-mono tabular-nums">
          {count > 1 && `${count} files · `}
          {formatBytes(loaded)} of {formatBytes(total)}
        </span>
      </span>
    );
  }
  if (drop.status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-danger-muted">
        <Warning2 variant="Bulk" className="size-3.5 shrink-0" color="currentColor" />
        {drop.error}
      </span>
    );
  }

  const ready = drop.files.filter((file) => file.status === "done").length;
  const failed = drop.files.length - ready;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
      <span className="font-medium text-success-muted">
        Ready to share
        {/* A folder's name doesn't say how many files it holds; "3 files" already does. */}
        {sharedFolder(drop.files.map((file) => file.path)) && (
          <span className="font-normal text-muted-foreground"> · {ready} files</span>
        )}
      </span>
      {failed > 0 && <span className="text-danger-muted">{failed} not uploaded</span>}
      <OptionTags drop={drop} />
    </span>
  );
}

/** The options a drop was uploaded with, so it's clear what the link does. */
function OptionTags({ drop }: { drop: UploadDrop }) {
  const tag = "inline-flex items-center gap-1 text-muted-foreground";
  return (
    <>
      {drop.protected && (
        <span className={tag}>
          <Lock variant="Bulk" className="size-3" color="currentColor" />
          Password
        </span>
      )}
      {drop.burnAfterDownload && (
        <span className={tag}>
          <Trash variant="Bulk" className="size-3" color="currentColor" />
          One download
        </span>
      )}
      {drop.expiresAt && (
        <span className={tag}>
          <Timer1 variant="Bulk" className="size-3" color="currentColor" />
          Expires {formatRelativeTime(drop.expiresAt)}
        </span>
      )}
    </>
  );
}

/** The files of a multi-file drop: open while uploading, folded away once the link is ready. */
function FileList({ drop, onRemoveFile }: { drop: UploadDrop; onRemoveFile: (fileKey: string) => void }) {
  const [openByUser, setOpenByUser] = React.useState<boolean | null>(null);
  const open = openByUser ?? drop.status !== "done";
  const listId = React.useId();
  // While uploading, any file can be taken out; once the link is ready, uploaded
  // files still can (they're deleted from the link), as long as one stays.
  const uploaded = drop.files.filter((file) => file.status === "done").length;
  const removable = (file: UploadFile) =>
    drop.dropId !== "" &&
    (drop.status === "uploading" || (drop.status === "done" && file.status === "done" && uploaded > 1));

  return (
    <div className="mt-3">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="-ml-1 text-muted-foreground"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpenByUser(!open)}
      >
        <ArrowDown2 className={cn("size-3 transition-transform", !open && "-rotate-90")} color="currentColor" />
        {open ? "Hide files" : `Show ${drop.files.length} files`}
      </Button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            id={listId}
            key="files"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mt-1 flex max-h-72 flex-col overflow-y-auto rounded-lg border bg-surface"
          >
            {drop.files.map((file) => (
              <FileLine
                key={file.id}
                file={file}
                uploading={drop.status === "uploading"}
                onRemove={removable(file) ? () => onRemoveFile(file.id) : undefined}
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function FileLine({
  file,
  uploading,
  onRemove,
}: {
  file: UploadFile;
  /** Whether its drop is still uploading: a waiting file only waits then. */
  uploading: boolean;
  onRemove?: () => void;
}) {
  const FileIcon = iconForFile(file.file.name, file.file.type);
  const folder = folderOf(file.path);

  return (
    <li className="flex min-h-9 items-center gap-2 border-b px-2.5 py-1.5 last:border-b-0">
      <FileIcon
        variant="Bulk"
        className={cn("size-4 shrink-0", file.status === "error" ? "text-danger-muted" : "text-muted-foreground")}
        color="currentColor"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-xs" title={file.path}>
          {folder && <span className="text-muted-foreground">{folder}/</span>}
          {baseName(file.path)}
        </span>
        {file.status === "error" && <span className="truncate text-2xs text-danger-muted">{file.error}</span>}
        {file.status === "uploading" && (
          <Progress
            value={file.percent}
            aria-label={`Uploading ${file.path}`}
            className="mt-1 h-0.5 *:data-[slot=progress-indicator]:bg-brand *:data-[slot=progress-indicator]:duration-150"
          />
        )}
      </div>
      <span className="shrink-0 font-mono text-2xs text-muted-foreground tabular-nums">
        {file.status === "uploading" ? `${Math.floor(file.percent)}%` : formatBytes(file.file.size)}
      </span>
      <FileState file={file} uploading={uploading} />
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Remove ${file.path}`}
          disabled={file.removing}
          onClick={onRemove}
          className="text-muted-foreground"
        >
          <CloseCircle variant="Bulk" className="size-3.5" color="currentColor" />
        </Button>
      )}
    </li>
  );
}

function FileState({ file, uploading }: { file: UploadFile; uploading: boolean }) {
  if (file.status === "done") {
    return (
      <TickCircle
        variant="Bold"
        className="size-3.5 shrink-0 text-success"
        color="currentColor"
        aria-label="Uploaded"
      />
    );
  }
  if (file.status === "error") {
    return (
      <Warning2
        variant="Bulk"
        className="size-3.5 shrink-0 text-danger-muted"
        color="currentColor"
        aria-label="Not uploaded"
      />
    );
  }
  if (file.status === "waiting" && uploading) {
    return <span className="shrink-0 text-2xs text-muted-foreground">Waiting</span>;
  }
  return null;
}

function SharePanel({ drop }: { drop: UploadDrop }) {
  const [emailOpen, setEmailOpen] = React.useState(false);

  return (
    <>
      <ShareLink drop={drop} emailOpen={emailOpen} onToggleEmail={() => setEmailOpen((open) => !open)} />
      <AnimatePresence initial={false}>
        {emailOpen && (
          <motion.div
            key="email"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            // The padding, offset by the negative margin, leaves room for the input's focus ring.
            className="-mx-1 -mb-1 overflow-hidden px-1 pb-1"
          >
            <ShareByEmail dropId={drop.dropId} protected={drop.protected} onSent={() => setEmailOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ShareLink({
  drop,
  emailOpen,
  onToggleEmail,
}: {
  drop: UploadDrop;
  emailOpen: boolean;
  onToggleEmail: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const url = drop.shareUrl;

  React.useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied", {
        description: drop.protected
          ? "Send the password separately: the link alone won't open it."
          : drop.burnAfterDownload
            ? "It works for one download, then the files are deleted."
            : "Anyone with the link can download the files.",
      });
    } catch {
      toast.error("Couldn't copy the link", { description: "Select it and copy it manually." });
    }
  };

  return (
    <div className="mt-3 flex items-center gap-2 rounded-lg border bg-surface py-1 pr-1 pl-2.5">
      <Link21 className="size-4 shrink-0 text-brand-muted" color="currentColor" />
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open the share page in a new tab"
        className="min-w-0 flex-1 truncate rounded-sm font-mono text-xs text-muted-foreground underline-offset-4 outline-none transition-colors hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {url.replace(/^https?:\/\//, "")}
      </a>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground">
            <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open share page in a new tab">
              <ExportSquare className="size-4" color="currentColor" />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open in new tab</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={emailOpen ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Send by email"
            aria-expanded={emailOpen}
            onClick={onToggleEmail}
            className={cn(!emailOpen && "text-muted-foreground")}
          >
            <Sms className="size-4" color="currentColor" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Send by email</TooltipContent>
      </Tooltip>
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
