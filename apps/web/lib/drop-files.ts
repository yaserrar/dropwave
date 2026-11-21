/** A file to upload and where it sits in the drop: "photos/2024/a.jpg", or just its name. */
export type PickedFile = { file: File; path: string };

// Files a folder carries without anyone choosing them.
const SYSTEM_FILES = new Set(["Thumbs.db", "desktop.ini"]);

/** Hidden and system files inside a dropped folder (.DS_Store, .git, Thumbs.db…) are left out. */
export function isSkippedInFolder(name: string): boolean {
  return name.startsWith(".") || SYSTEM_FILES.has(name);
}

/**
 * What was dropped, read synchronously: the browser empties the DataTransfer as
 * soon as the drop event returns, so this must run before any await.
 */
export function readDataTransfer(dataTransfer: DataTransfer): {
  entries: FileSystemEntry[];
  files: File[];
} {
  const entries = Array.from(dataTransfer.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => !!entry);
  return { entries, files: Array.from(dataTransfer.files) };
}

const isFile = (entry: FileSystemEntry): entry is FileSystemFileEntry => entry.isFile;
const isDirectory = (entry: FileSystemEntry): entry is FileSystemDirectoryEntry => entry.isDirectory;

const fileOf = (entry: FileSystemFileEntry) => new Promise<File>((resolve, reject) => entry.file(resolve, reject));

/** A folder's children. readEntries returns them in batches (100 in Chrome) until an empty one. */
async function childrenOf(directory: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = directory.createReader();
  const children: FileSystemEntry[] = [];
  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) return children;
    children.push(...batch);
  }
}

/**
 * Every file under the dropped entries, folders walked depth-first, with paths
 * relative to what was dropped. Stops once it has more than `limit` files, so a
 * huge folder isn't read just to be refused: `tooMany` then says so.
 */
export async function walkEntries(
  entries: FileSystemEntry[],
  limit: number,
): Promise<{ files: PickedFile[]; tooMany: boolean }> {
  const files: PickedFile[] = [];

  const visit = async (entry: FileSystemEntry, inFolder: boolean): Promise<boolean> => {
    if (inFolder && isSkippedInFolder(entry.name)) return true;
    if (isFile(entry)) {
      // fullPath is "/photos/a.jpg" for something inside a dropped folder.
      files.push({ file: await fileOf(entry), path: entry.fullPath.replace(/^\/+/, "") || entry.name });
      return files.length <= limit;
    }
    if (isDirectory(entry)) {
      for (const child of await childrenOf(entry)) {
        if (!(await visit(child, true))) return false;
      }
    }
    return true;
  };

  for (const entry of entries) {
    if (!(await visit(entry, false))) return { files: files.slice(0, limit), tooMany: true };
  }
  return { files, tooMany: false };
}

/** Files from an <input type="file">; with `webkitdirectory`, each knows its path in the folder. */
export function filesFromInput(list: FileList): PickedFile[] {
  return Array.from(list)
    .map((file) => ({ file, path: file.webkitRelativePath || file.name }))
    .filter(({ path }) => {
      const segments = path.split("/");
      return segments.length === 1 || !segments.some(isSkippedInFolder);
    });
}

/**
 * Paths unique within the drop, ignoring case like macOS and Windows do when the
 * zip is extracted: a second "image.png" (pasted screenshots) becomes "image (2).png",
 * and a loose file named like a dropped folder ("notes" next to "notes/") becomes
 * "notes (2)", since one name can't be both.
 */
export function withUniquePaths(files: PickedFile[]): PickedFile[] {
  const taken = new Set(
    files.flatMap(({ path }) => {
      const segments = path.toLowerCase().split("/").slice(0, -1);
      return segments.map((_, index) => segments.slice(0, index + 1).join("/"));
    }),
  );
  return files.map((picked) => {
    let path = picked.path;
    const slash = path.lastIndexOf("/");
    const dot = path.lastIndexOf(".");
    const stemEnd = dot > slash + 1 ? dot : path.length;
    for (let n = 2; taken.has(path.toLowerCase()); n++) {
      path = `${picked.path.slice(0, stemEnd)} (${n})${picked.path.slice(stemEnd)}`;
    }
    taken.add(path.toLowerCase());
    return path === picked.path ? picked : { ...picked, path };
  });
}

/** "photos/2024/a.jpg" → "a.jpg". */
export function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** "photos/2024/a.jpg" → "photos/2024", or "" for a loose file. */
export function folderOf(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash);
}

/** The folder every path starts with, when the drop is one folder ("photos"); else null. */
export function sharedFolder(paths: string[]): string | null {
  const [first] = paths;
  if (!first || !first.includes("/")) return null;
  const folder = first.slice(0, first.indexOf("/"));
  return paths.every((path) => path.startsWith(`${folder}/`)) ? folder : null;
}

/** How a drop is named: the file's name, the folder's name, or "3 files" (like the API's emails). */
export function dropTitle(paths: string[]): string {
  if (paths.length === 1) return baseName(paths[0]!);
  return sharedFolder(paths) ?? `${paths.length} files`;
}

export type TreeRow<T> =
  | { kind: "folder"; key: string; name: string; depth: number }
  | { kind: "file"; key: string; name: string; depth: number; item: T };

type Folder<T> = { folders: Map<string, Folder<T>>; files: { name: string; item: T }[] };

const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare;

/**
 * Files as an indented tree: each folder's subfolders first, then its files, both
 * in natural order ("2.jpg" before "10.jpg"). A folder that holds everything is
 * left out; the drop is already named after it.
 */
export function treeRows<T extends { path: string }>(items: T[]): TreeRow<T>[] {
  const root: Folder<T> = { folders: new Map(), files: [] };
  const common = sharedFolder(items.map((item) => item.path));

  for (const item of items) {
    const path = common ? item.path.slice(common.length + 1) : item.path;
    const segments = path.split("/");
    const name = segments.pop()!;
    let folder = root;
    for (const segment of segments) {
      let child = folder.folders.get(segment);
      if (!child) {
        child = { folders: new Map(), files: [] };
        folder.folders.set(segment, child);
      }
      folder = child;
    }
    folder.files.push({ name, item });
  }

  const rows: TreeRow<T>[] = [];
  const flatten = (folder: Folder<T>, depth: number, prefix: string) => {
    for (const name of [...folder.folders.keys()].sort(byName)) {
      const key = `${prefix}${name}/`;
      rows.push({ kind: "folder", key, name, depth });
      flatten(folder.folders.get(name)!, depth + 1, key);
    }
    for (const { name, item } of [...folder.files].sort((a, b) => byName(a.name, b.name))) {
      rows.push({ kind: "file", key: item.path, name, depth, item });
    }
  };
  flatten(root, 0, "");
  return rows;
}
