import type { PrismaService } from '../prisma/prisma.service.js';
import type { S3Service } from '../s3/s3.service.js';

/**
 * Deletes files' S3 objects, then marks the ones really gone as DELETED, so a
 * failed delete keeps its status and is retried later. Returns S3's errors.
 */
export async function purgeFiles(
  prisma: PrismaService,
  s3: S3Service,
  files: { id: string; key: string }[],
) {
  const result = await s3.deleteObjects(files.map((file) => file.key));
  const gone = new Set(result.deleted);
  await prisma.file.updateMany({
    where: {
      id: { in: files.filter((f) => gone.has(f.key)).map((f) => f.id) },
    },
    data: { status: 'DELETED' },
  });
  return { deleted: gone.size, errors: result.errors };
}
