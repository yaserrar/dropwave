export const MAX_FILE_SIZE = 1024 * 1024 * 10; // 10MB
// Email addresses per share request (keep in sync with apps/api/src/lib/consts.ts).
export const MAX_SHARE_RECIPIENTS = 5;

// Optional share-link expiry (keep in sync with apps/api/src/lib/consts.ts).
export const MIN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes from now
export const MAX_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days from now
