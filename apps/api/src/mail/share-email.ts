import type { Email } from './mail.service.js';

const UNITS = ['B', 'KB', 'MB', 'GB'];

/** 1536 → "1.5 KB", like formatBytes in the web app. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    UNITS.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${UNITS[exponent]}`;
}

// The recipient's time zone is unknown, so dates are in UTC and say so.
const dateFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'UTC',
});

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]!);
}

/** The email a recipient gets when someone shares a file with them. */
export function shareEmail(
  file: { filename: string; size: number; expiresAt: Date | null },
  url: string,
): Email {
  // The filename is the uploader's text: kept on one line for the subject, and
  // escaped in the HTML so it can't add markup or links.
  const name = file.filename.replace(/\p{Cc}+/gu, ' ').trim();
  const details = file.expiresAt
    ? `${formatBytes(file.size)} · available until ${dateFormat.format(file.expiresAt)} UTC`
    : formatBytes(file.size);
  const footer =
    "You received this because someone entered your address on Dropwave. If you weren't expecting a file, you can ignore this email.";

  const text = [
    'Someone sent you a file with Dropwave.',
    '',
    name,
    details,
    '',
    `View and download it here: ${url}`,
    '',
    footer,
  ].join('\n');

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#171717">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:32px">
      <p style="margin:0 0 24px;font-size:14px;font-weight:600">Dropwave</p>
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600">Someone sent you a file</h1>
      <p style="margin:0 0 4px;font-size:15px;font-weight:500;word-break:break-all">${escapeHtml(name)}</p>
      <p style="margin:0 0 24px;font-size:14px;color:#737373">${escapeHtml(details)}</p>
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;background:#171717;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">View file</a>
      <p style="margin:24px 0 0;font-size:12px;color:#a3a3a3">${footer}</p>
    </div>
  </body>
</html>`;

  return { subject: `A file was shared with you: ${name}`, text, html };
}
