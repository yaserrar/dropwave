export const S3_UPLOAD_EXPIRES_IN = 60; // 1 minute in seconds
export const S3_DOWNLOAD_EXPIRES_IN = 60 * 60; // 1 hour in seconds
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB in bytes
export const MAX_SHARE_RECIPIENTS = 5; // email addresses per share request
// Optional share-link expiry chosen at upload (keep in sync with apps/web/lib/consts.ts).
export const MIN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes from now, so the upload can finish
export const MAX_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days from now
