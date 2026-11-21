import { shareEmail, type SharedDrop } from './share-email.js';

const url = 'https://dropwave.test/s/abc';
const drop: SharedDrop = {
  title: 'holiday <photos>',
  fileCount: 3,
  size: 3 * 1024 * 1024,
  expiresAt: null,
  protected: false,
  burnAfterDownload: false,
};

describe('shareEmail', () => {
  it('names the files and escapes the name in HTML', () => {
    const email = shareEmail(drop, url);
    expect(email.subject).toBe('Files were shared with you: holiday <photos>');
    expect(email.text).toContain('3 files · 3.0 MB');
    expect(email.html).toContain('holiday &lt;photos&gt;');
    expect(email.html).not.toContain('<photos>');
  });

  it('names nothing for a protected link', () => {
    const email = shareEmail({ ...drop, protected: true }, url);
    for (const part of [email.subject, email.text, email.html]) {
      expect(part).not.toContain('holiday');
      expect(part).not.toContain('3 files');
    }
    expect(email.text).toContain('Ask the sender for the password');
    expect(email.text).toContain(url);
  });

  it('warns that a burn-after-download link works once', () => {
    const email = shareEmail(
      { ...drop, fileCount: 1, burnAfterDownload: true },
      url,
    );
    expect(email.subject).toBe('A file was shared with you: holiday <photos>');
    expect(email.text).toContain('downloaded only once');
  });
});
