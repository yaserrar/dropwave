"use client";

import * as React from "react";
import { motion } from "motion/react";
import { DocumentCopy, Folder2, ImportCurve } from "iconsax-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { dropTitle, sharedFolder, treeRows } from "@/lib/drop-files";
import { iconForFile } from "@/lib/file-icons";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import dropsService from "@/services/drops";
import type { DropFile, OpenDrop } from "@/types/drop";
import { FilePreviewDialog } from "./file-preview-dialog";
import {
  BurnNotice,
  CopyLinkButton,
  DownloadButton,
  EmailShare,
  IconTile,
  LinkFacts,
  PrivacyFooter,
  ShareCardFrame,
  rise,
  stagger,
} from "./share-actions";

// Deeper folders stop indenting, so names keep room on a phone.
const MAX_INDENT = 4;

/**
 * The share page for a link with several files or a folder: the files as a tree,
 * each with its own preview and download, and "Download all" as one zip. Files the
 * check rejected stay listed as removed; the others are available.
 */
export function SharedBundleCard({
  drop,
  beforeBurn,
}: {
  drop: OpenDrop;
  /** Checks a burn-after-download link still works before its one download. */
  beforeBurn: () => Promise<boolean>;
}) {
  const paths = drop.files.map((file) => file.path);
  const available = drop.files.filter((file) => file.status === "UPLOADED");
  const checking = drop.files.filter((file) => file.status === "SCANNING").length;
  const removed = drop.files.filter((file) => file.status === "REMOVED").length;
  const totalSize = available.reduce((sum, file) => sum + file.size, 0);
  const folder = sharedFolder(paths);
  const [used, setUsed] = React.useState(false);

  return (
    <ShareCardFrame>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative flex flex-col items-center px-4 pt-10 pb-6 text-center sm:px-8"
      >
        <motion.div variants={rise}>
          <IconTile icon={folder ? Folder2 : DocumentCopy} />
        </motion.div>
        {checking > 0 ? (
          <motion.span
            variants={rise}
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-warning-subtle px-2.5 py-0.5 text-xs font-medium text-warning-muted"
          >
            Checking {checking} {checking === 1 ? "file" : "files"}
          </motion.span>
        ) : (
          <motion.span
            variants={rise}
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-brand-subtle px-2.5 py-0.5 text-xs font-medium text-brand-muted"
          >
            Shared with you
          </motion.span>
        )}

        <motion.h1
          variants={rise}
          className="mt-3 line-clamp-2 font-heading text-2xl leading-tight font-medium tracking-tight wrap-break-word sm:text-[28px]"
        >
          {dropTitle(paths)}
        </motion.h1>

        <motion.p
          variants={rise}
          className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
        >
          <span>
            {available.length} {available.length === 1 ? "file" : "files"}
          </span>
          <span className="font-mono tabular-nums">{formatBytes(totalSize)}</span>
          <span aria-hidden className="size-1 rounded-full bg-border-strong" />
          <span>Uploaded {formatRelativeTime(drop.createdAt)}</span>
        </motion.p>

        <LinkFacts expiresAt={drop.expiresAt} isProtected={drop.protected} burnAfterDownload={drop.burnAfterDownload} />

        <motion.div variants={rise} className="mt-8 flex w-full gap-2">
          <DownloadButton
            href={dropsService.zipDownloadUrl(drop.id)}
            label={`Download all (${available.length})`}
            ready={checking === 0 && available.length > 0}
            used={used}
            beforeDownload={
              drop.burnAfterDownload
                ? async () => {
                    const ok = await beforeBurn();
                    if (ok) setUsed(true);
                    return ok;
                  }
                : undefined
            }
          />
          <CopyLinkButton />
        </motion.div>
        <motion.p variants={rise} className="mt-2 text-xs text-muted-foreground">
          {checking > 0
            ? "Download all opens once every file has been checked."
            : `One zip${folder ? `, with the folder structure` : ""}.`}
        </motion.p>

        {drop.burnAfterDownload && <BurnNotice used={used} many />}

        <motion.div variants={rise} className="mt-6 w-full">
          <FileTree drop={drop} perFile={!drop.burnAfterDownload} />
          {removed > 0 && (
            <p className="mt-2 text-left text-xs text-muted-foreground">
              {removed === 1 ? "1 file was" : `${removed} files were`} removed by the file check: the content
              didn&apos;t match its type. The others are safe to download.
            </p>
          )}
        </motion.div>

        {!used && <EmailShare dropId={drop.id} isProtected={drop.protected} disabled={checking > 0} />}
      </motion.div>

      <PrivacyFooter>Stored privately · only people with this link can download these files</PrivacyFooter>
    </ShareCardFrame>
  );
}

/** Folders and files, indented; `perFile` adds each file's preview and download. */
function FileTree({ drop, perFile }: { drop: OpenDrop; perFile: boolean }) {
  const rows = treeRows(drop.files);

  return (
    <ul aria-label="Files" className="overflow-hidden rounded-xl border bg-surface text-left">
      {rows.map((row) => {
        const indent = { paddingLeft: `${0.75 + Math.min(row.depth, MAX_INDENT) * 1}rem` };
        if (row.kind === "folder") {
          return (
            <li
              key={row.key}
              style={indent}
              className="flex min-h-10 items-center gap-2 border-b py-2 pr-3 text-sm font-medium text-muted-foreground last:border-b-0"
            >
              <Folder2 variant="Bulk" className="size-4 shrink-0 text-brand-muted" color="currentColor" />
              <span className="truncate">{row.name}</span>
            </li>
          );
        }
        return (
          <FileTreeRow key={row.key} drop={drop} file={row.item} name={row.name} style={indent} perFile={perFile} />
        );
      })}
    </ul>
  );
}

function FileTreeRow({
  drop,
  file,
  name,
  style,
  perFile,
}: {
  drop: OpenDrop;
  file: DropFile;
  name: string;
  style: React.CSSProperties;
  perFile: boolean;
}) {
  const FileIcon = iconForFile(file.filename, file.contentType);
  const removed = file.status === "REMOVED";
  const downloadUrl = dropsService.fileDownloadUrl(drop.id, file.id);

  return (
    <li style={style} className="flex min-h-11 items-center gap-2 border-b py-1.5 pr-1.5 last:border-b-0">
      <FileIcon
        variant="Bulk"
        className={cn("size-4 shrink-0", removed ? "text-muted-foreground/60" : "text-brand-muted")}
        color="currentColor"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate text-sm", removed && "text-muted-foreground line-through")} title={file.path}>
          {name}
        </span>
        <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <span className="font-mono tabular-nums">{formatBytes(file.size)}</span>
          {file.status === "SCANNING" && <span className="text-warning-muted">· Checking</span>}
          {removed && <span className="text-danger-muted">· Removed by the check</span>}
        </span>
      </div>
      {perFile && file.status === "UPLOADED" && (
        <div className="flex shrink-0 items-center">
          <FilePreviewDialog dropId={drop.id} file={file} downloadUrl={downloadUrl} compact />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground">
                <a href={downloadUrl} aria-label={`Download ${file.filename}`}>
                  <ImportCurve variant="Bulk" className="size-4" color="currentColor" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Download</TooltipContent>
          </Tooltip>
        </div>
      )}
    </li>
  );
}
