export const S3_UPLOAD_EXPIRES_IN = 60; // 1 minute in seconds
export const S3_DOWNLOAD_EXPIRES_IN = 60 * 60; // 1 hour in seconds
// Burn-after-download links: a presigned URL can be reused until it expires, so keep it short.
export const S3_BURN_DOWNLOAD_EXPIRES_IN = 60; // 1 minute in seconds
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB in bytes
export const MAX_SHARE_RECIPIENTS = 5; // email addresses per share request
// Optional share-link expiry chosen at upload (keep in sync with apps/web/lib/consts.ts).
export const MIN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes from now, so the upload can finish
export const MAX_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days from now

// One link (a drop) holds several files or a folder (keep in sync with apps/web/lib/consts.ts).
export const MAX_FILES_PER_DROP = 20;
export const MAX_DROP_SIZE = 100 * 1024 * 1024; // 100 MB in bytes, all files together
export const MAX_PATH_LENGTH = 512; // characters, for a file's path inside its folder

// Optional link password (keep in sync with apps/web/lib/consts.ts).
export const PASSWORD_MIN_LENGTH = 4;
export const PASSWORD_MAX_LENGTH = 128;
// How long a correct password keeps the link open in that browser.
export const UNLOCK_TOKEN_TTL_SECONDS = 15 * 60;
// Wrong passwords allowed per link before it refuses more attempts for a while.
export const UNLOCK_MAX_FAILURES = 5;
export const UNLOCK_WINDOW_MS = 10 * 60 * 1000;
// Lets the browser that created a drop upload its files, and nobody else.
export const UPLOAD_TOKEN_TTL_SECONDS = 60 * 60;
// A downloaded burn-after-download file is deleted once its download URL has expired.
export const BURN_PURGE_DELAY_MS = (S3_BURN_DOWNLOAD_EXPIRES_IN + 60) * 1000;
// A "Download all" zip deletes its files itself when it ends, however long a slow
// client takes; the purge job only sweeps up after one cut short by a restart.
export const BURN_ZIP_PURGE_DELAY_MS = 6 * 60 * 60 * 1000; // 6 hours
