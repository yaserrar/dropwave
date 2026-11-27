import {
  dropTitle,
  findPathConflict,
  normalizeRelativePath,
  zipFileName,
} from './drop-paths.js';

const dropId = '0a1b2c3d-0000-4000-8000-000000000000';

describe('normalizeRelativePath', () => {
  it('keeps simple names and folder paths', () => {
    expect(normalizeRelativePath('report.pdf')).toBe('report.pdf');
    expect(normalizeRelativePath('photos/2024/a b.jpg')).toBe(
      'photos/2024/a b.jpg',
    );
  });

  it('cleans separators and empty or "." segments', () => {
    expect(normalizeRelativePath('/photos//./a.jpg')).toBe('photos/a.jpg');
    expect(normalizeRelativePath('photos\\2024\\a.jpg')).toBe(
      'photos/2024/a.jpg',
    );
  });

  it('refuses paths that leave the folder or hide characters', () => {
    expect(normalizeRelativePath('../etc/passwd')).toBeNull();
    expect(normalizeRelativePath('photos/../../a.jpg')).toBeNull();
    expect(normalizeRelativePath('a\u0000b.txt')).toBeNull();
    expect(normalizeRelativePath('line\nbreak.txt')).toBeNull();
  });

  it('refuses empty, blank and overlong paths', () => {
    expect(normalizeRelativePath('')).toBeNull();
    expect(normalizeRelativePath('///')).toBeNull();
    expect(normalizeRelativePath('photos/   /a.jpg')).toBeNull();
    expect(normalizeRelativePath(`${'a'.repeat(256)}.txt`)).toBeNull();
    expect(
      normalizeRelativePath(Array(80).fill('folder').join('/')),
    ).toBeNull();
  });
});

describe('findPathConflict', () => {
  it('finds paths that differ only by case', () => {
    expect(findPathConflict(['a.txt', 'b/A.TXT', 'B/a.txt'])).toEqual({
      path: 'B/a.txt',
      kind: 'duplicate',
    });
    expect(findPathConflict(['a.txt', 'b/a.txt'])).toBeNull();
  });

  it('finds a file named like a folder, whichever comes first', () => {
    expect(findPathConflict(['notes', 'notes/b.txt'])).toEqual({
      path: 'notes',
      kind: 'file-and-folder',
    });
    expect(findPathConflict(['a/Notes/b.txt', 'A/notes'])).toEqual({
      path: 'A/notes',
      kind: 'file-and-folder',
    });
    expect(findPathConflict(['notes.txt', 'notes/b.txt'])).toBeNull();
  });
});

describe('dropTitle and zipFileName', () => {
  it('uses the file name for one file', () => {
    expect(dropTitle(['notes/report.final.pdf'])).toBe('report.final.pdf');
    expect(zipFileName(['report.final.pdf'], dropId)).toBe('report.final.zip');
    expect(zipFileName(['.env'], dropId)).toBe('.env.zip');
  });

  it('uses the folder name when everything is in one folder', () => {
    const paths = ['photos/a.jpg', 'photos/2024/b.jpg'];
    expect(dropTitle(paths)).toBe('photos');
    expect(zipFileName(paths, dropId)).toBe('photos.zip');
  });

  it('falls back to a count and the link id for loose files', () => {
    const paths = ['a.jpg', 'photos/b.jpg', 'c.txt'];
    expect(dropTitle(paths)).toBe('3 files');
    expect(zipFileName(paths, dropId)).toBe('dropwave-0a1b2c3d.zip');
  });
});
