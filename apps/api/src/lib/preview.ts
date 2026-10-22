export type PreviewKind = 'image' | 'pdf' | 'text';

// Keep in sync with apps/web/lib/preview.ts.
export function previewKind(contentType: string): PreviewKind | null {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType.startsWith('text/') || contentType === 'application/json') {
    return 'text';
  }
  return null;
}
