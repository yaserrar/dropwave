import { formatBytes } from '../lib/format.js';
import type { Email } from './mail.service.js';

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

/** What the email says about a drop. */
export type SharedDrop = {
  /** The file's name, the folder's name or "3 files". Left out when protected. */
  title: string;
  fileCount: number;
  size: number;
  expiresAt: Date | null;
  protected: boolean;
  burnAfterDownload: boolean;
};

/**
 * The email a recipient gets when someone shares a link with them. For a protected
 * link it names nothing (the share page hides names until unlocked too), and it
 * never carries the password: only its hash is stored.
 */
export function shareEmail(drop: SharedDrop, url: string): Email {
  // The title is the uploader's text: kept on one line for the subject, and
  // escaped in the HTML so it can't add markup or links.
  const name = drop.protected
    ? 'Protected with a password'
    : drop.title.replace(/\p{Cc}+/gu, ' ').trim();
  const many = drop.fileCount > 1;
  const what = drop.protected ? 'a protected link' : many ? 'files' : 'a file';

  const facts = drop.protected
    ? ['Ask the sender for the password']
    : [...(many ? [`${drop.fileCount} files`] : []), formatBytes(drop.size)];
  if (drop.expiresAt) {
    facts.push(`available until ${dateFormat.format(drop.expiresAt)} UTC`);
  }
  const details = facts.join(' · ');
  const once = drop.burnAfterDownload
    ? 'It can be downloaded only once, then it is deleted.'
    : null;
  const footer =
    "You received this because someone entered your address on Dropwave. If you weren't expecting a file, you can ignore this email.";

  const text = [
    `Someone sent you ${what} with Dropwave.`,
    '',
    name,
    details,
    ...(once ? [once] : []),
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
      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600">Someone sent you ${what}</h1>
      <p style="margin:0 0 4px;font-size:15px;font-weight:500;word-break:break-all">${escapeHtml(name)}</p>
      <p style="margin:0 0 ${once ? 8 : 24}px;font-size:14px;color:#737373">${escapeHtml(details)}</p>${
        once
          ? `
      <p style="margin:0 0 24px;font-size:14px;color:#737373">${once}</p>`
          : ''
      }
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;background:#171717;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">${many && !drop.protected ? 'View files' : 'View file'}</a>
      <p style="margin:24px 0 0;font-size:12px;color:#a3a3a3">${footer}</p>
    </div>
  </body>
</html>`;

  const subject = drop.protected
    ? 'A protected link was shared with you'
    : `${many ? 'Files were' : 'A file was'} shared with you: ${name}`;
  return { subject, text, html };
}
