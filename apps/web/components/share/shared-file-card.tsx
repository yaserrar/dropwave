"use client";

import * as React from "react";
import { motion } from "motion/react";
import { iconForFile } from "@/lib/file-icons";
import { fileTypeLabel, formatBytes, formatRelativeTime } from "@/lib/format";
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

/** The share page for a link with one file. */
export function SharedFileCard({
  drop,
  file,
  beforeBurn,
}: {
  drop: OpenDrop;
  file: DropFile;
  /** Checks a burn-after-download link still works before its one download. */
  beforeBurn: () => Promise<boolean>;
}) {
  const FileIcon = iconForFile(file.filename, file.contentType);
  const ready = file.status === "UPLOADED";
  const downloadUrl = dropsService.fileDownloadUrl(drop.id, file.id);
  // Set once this browser started the one download of a burn-after-download link.
  const [used, setUsed] = React.useState(false);

  return (
    <ShareCardFrame>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative flex flex-col items-center px-6 pt-10 pb-6 text-center sm:px-10"
      >
        <motion.div variants={rise}>
          <IconTile icon={FileIcon} />
        </motion.div>
        {ready ? (
          <motion.span
            variants={rise}
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-brand-subtle px-2.5 py-0.5 text-xs font-medium text-brand-muted"
          >
            Shared with you
          </motion.span>
        ) : (
          <motion.span
            variants={rise}
            className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-warning-subtle px-2.5 py-0.5 text-xs font-medium text-warning-muted"
          >
            File is being scanned
          </motion.span>
        )}

        <motion.h1
          variants={rise}
          title={file.filename}
          className="mt-3 line-clamp-2 font-heading text-2xl leading-tight font-medium tracking-tight wrap-break-word sm:text-[28px]"
        >
          {file.filename}
        </motion.h1>

        <motion.p
          variants={rise}
          className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground"
        >
          <span className="rounded-sm border bg-muted px-1.5 py-px font-mono text-2xs font-medium text-foreground">
            {fileTypeLabel(file.filename, file.contentType)}
          </span>
          <span className="font-mono tabular-nums">{formatBytes(file.size)}</span>
          <span aria-hidden className="size-1 rounded-full bg-border-strong" />
          <span>Uploaded {formatRelativeTime(drop.createdAt)}</span>
        </motion.p>

        <LinkFacts expiresAt={drop.expiresAt} isProtected={drop.protected} burnAfterDownload={drop.burnAfterDownload} />

        <motion.div variants={rise} className="mt-8 flex w-full gap-2">
          <DownloadButton
            href={downloadUrl}
            label="Download file"
            ready={ready}
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
          {!drop.burnAfterDownload && <FilePreviewDialog dropId={drop.id} file={file} downloadUrl={downloadUrl} />}
          <CopyLinkButton />
        </motion.div>

        {drop.burnAfterDownload && <BurnNotice used={used} many={false} />}

        {!used && <EmailShare dropId={drop.id} isProtected={drop.protected} disabled={!ready} />}
      </motion.div>

      <PrivacyFooter>Stored privately · only people with this link can download it</PrivacyFooter>
    </ShareCardFrame>
  );
}

export function SharedDropSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="frame-double"
      aria-busy
      aria-label="Loading"
    >
      <div className="flex flex-col items-center rounded-[13px] border bg-card px-6 pt-10 pb-6 sm:px-10">
        <div className="size-20 animate-pulse rounded-3xl bg-muted" />
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
