export const MAX_FILE_SIZE = 1024 * 1024 * 20; // 20MB
// Email addresses per share request (keep in sync with apps/api/src/lib/consts.ts).
export const MAX_SHARE_RECIPIENTS = 5;

// Optional share-link expiry (keep in sync with apps/api/src/lib/consts.ts).
export const MIN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes from now
export const MAX_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days from now

// One link holds several files or a folder (keep in sync with apps/api/src/lib/consts.ts).
export const MAX_FILES_PER_DROP = 20;
export const MAX_DROP_SIZE = 1024 * 1024 * 100; // 100MB, all files together

// Optional link password (keep in sync with apps/api/src/lib/consts.ts).
export const PASSWORD_MIN_LENGTH = 4;
export const PASSWORD_MAX_LENGTH = 128;

// Files uploaded at the same time, across every drop on the page.
export const UPLOAD_CONCURRENCY = 3;
// Upload URLs are valid for 60 s; past this age, ask the API for a fresh one.
export const UPLOAD_URL_FRESH_MS = 45 * 1000;
