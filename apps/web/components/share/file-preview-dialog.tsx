"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Danger, ExportSquare, Eye, ImportCurve } from "iconsax-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useGetPreview, useGetPreviewText } from "@/hooks/files";
import { iconForFile } from "@/lib/file-icons";
import { fileTypeLabel, formatBytes } from "@/lib/format";
import { previewKind, type PreviewKind } from "@/lib/preview";
import { cn } from "@/lib/utils";
import type { FileInfo } from "@/types/file";

// Big text files would make the page sluggish; show the start and offer the download.
const MAX_TEXT_CHARS = 100_000;

/** "Preview" button + dialog. Renders nothing for types the browser can't show. */
export function FilePreviewDialog({
  file,
  downloadUrl,
}: {
  file: FileInfo;
  downloadUrl: string;
}) {
  const [open, setOpen] = React.useState(false);
  const kind = previewKind(file.contentType);
  const preview = useGetPreview(file.id, open && kind !== null);
  const FileIcon = iconForFile(file.filename, file.contentType);

  if (!kind) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          disabled={file.status !== "UPLOADED"}
          variant="outline"
          size="lg"
          className={cn(
            "h-11 rounded-lg px-3.5",
            file.status !== "UPLOADED" && "cursor-not-allowed opacity-50",
          )}
          aria-label="Preview file"
        >
          <Eye className="size-4.5" color="currentColor" />
          <span className="max-sm:hidden">Preview</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="flex-row items-center gap-3 border-b px-4 py-3 pr-12 text-left">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-surface text-brand-muted">
            <FileIcon
              variant="Bulk"
              className="size-4.5"
              color="currentColor"
            />
          </div>
          <div className="min-w-0">
            <DialogTitle className="truncate font-heading text-sm font-medium">
              {file.filename}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {fileTypeLabel(file.filename, file.contentType)} ·{" "}
              {formatBytes(file.size)}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 overflow-auto bg-surface">
          {preview.isPending ? (
            <PreviewLoading />
          ) : preview.isError || !preview.data ? (
            <PreviewError />
          ) : (
            <PreviewBody
              kind={kind}
              url={preview.data.url}
              filename={file.filename}
            />
          )}
        </div>

        {/* m-0: shadcn's footer pulls itself out with -mx-4/-mb-4 to fill the default p-4, which this dialog removes. */}
        <DialogFooter className="m-0 flex-row justify-end gap-2 border-t px-4 py-3">
          {preview.data && kind !== "text" && (
            <Button asChild variant="ghost" size="lg">
              <a
                href={preview.data.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExportSquare className="size-4" color="currentColor" />
                Open in new tab
              </a>
            </Button>
          )}
          <Button
            asChild
            size="lg"
            className="bg-brand text-brand-foreground hover:bg-brand-hover"
          >
            <a href={downloadUrl}>
              <ImportCurve className="size-4" color="currentColor" />
              Download
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({
  kind,
  url,
  filename,
}: {
  kind: PreviewKind;
  url: string;
  filename: string;
}) {
  if (kind === "image") return <ImagePreview url={url} filename={filename} />;
  if (kind === "pdf") return <PdfPreview url={url} filename={filename} />;
  return <TextPreview url={url} />;
}

function ImagePreview({ url, filename }: { url: string; filename: string }) {
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  if (failed) return <PreviewError />;

  return (
    <div className="bg-dot-grid relative flex min-h-72 items-center justify-center p-4 sm:p-6">
      {!loaded && <PreviewLoading className="absolute inset-0" />}
      {/* A presigned S3 URL that changes per request, so next/image's optimizer can't help here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <motion.img
        src={url}
        alt={`Preview of ${filename}`}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={
          loaded ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.98 }
        }
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="max-h-[70dvh] w-auto max-w-full rounded-lg object-contain shadow-lg"
      />
    </div>
  );
}

function PdfPreview({ url, filename }: { url: string; filename: string }) {
  const [loaded, setLoaded] = React.useState(false);

  return (
    <div className="relative h-[70dvh]">
      {!loaded && <PreviewLoading className="absolute inset-0" />}
      <iframe
        src={url}
        title={`Preview of ${filename}`}
        onLoad={() => setLoaded(true)}
        className={cn(
          "size-full transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

function TextPreview({ url }: { url: string }) {
  const text = useGetPreviewText(url);

  if (text.isPending) return <PreviewLoading />;
  if (text.isError) return <PreviewError />;

  const truncated = text.data.length > MAX_TEXT_CHARS;
  return (
    <div>
      <pre className="max-h-[70dvh] overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground wrap-break-word sm:p-5">
        {truncated ? text.data.slice(0, MAX_TEXT_CHARS) : text.data}
      </pre>
      {truncated && (
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          Showing the first {MAX_TEXT_CHARS.toLocaleString()} characters.
          Download the file to see all of it.
        </p>
      )}
    </div>
  );
}

function PreviewLoading({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex min-h-72 flex-col items-center justify-center gap-3",
        className,
      )}
      aria-busy
      aria-label="Loading preview"
    >
      <span className="dot-running size-2 rounded-full" />
      <span className="text-shimmer-brand text-sm font-medium">
        Loading preview
      </span>
    </div>
  );
}

function PreviewError() {
  return (
    <div
      role="alert"
      className="flex min-h-72 flex-col items-center justify-center gap-2 px-6 text-center"
    >
      <div className="flex size-10 items-center justify-center rounded-xl bg-danger-subtle text-danger-muted">
        <Danger variant="Bulk" className="size-5" color="currentColor" />
      </div>
      <p className="text-sm font-medium">Couldn&apos;t load the preview</p>
      <p className="text-xs text-muted-foreground">
        You can still download the file.
      </p>
    </div>
  );
}
