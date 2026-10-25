import { MAX_FILE_SIZE, MAX_SHARE_RECIPIENTS } from "@/lib/consts";
import { z } from "zod";

const VALID_MIME_TYPE = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/tiff",
  //-------
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export const generateSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z
    .string()
    .min(1)
    .max(255)
    .refine((value) => VALID_MIME_TYPE.includes(value), {
      message: "Content type must be a valid MIME type",
    }),
  size: z.number().min(1).max(MAX_FILE_SIZE),

  expiresAt: z.date().optional(),
});

export type GenerateSchema = z.infer<typeof generateSchema>;

export const confirmSchema = z.object({
  id: z.string().min(1).max(255),
});

export type ConfirmSchema = z.infer<typeof confirmSchema>;

export const shareSchema = z.object({
  emails: z
    .array(z.email())
    .min(1, "Enter at least one email address")
    .max(MAX_SHARE_RECIPIENTS, `Up to ${MAX_SHARE_RECIPIENTS} addresses at a time`),
});

export type ShareSchema = z.infer<typeof shareSchema>;
