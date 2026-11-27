-- A drop is what one link shares: one file, several files or a folder. Every
-- existing file becomes a one-file drop whose id is the file's id, so the links
-- already sent (/s/<file id>) keep working.

-- CreateTable
CREATE TABLE "drops" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "burnAfterDownload" BOOLEAN NOT NULL DEFAULT false,
    "consumedAt" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "unlockFailures" INTEGER NOT NULL DEFAULT 0,
    "unlockWindowStart" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drops_pkey" PRIMARY KEY ("id")
);

-- One drop per existing file, carrying the file's expiry.
INSERT INTO "drops" ("id", "expiresAt", "createdAt", "updatedAt")
SELECT "id", "expiresAt", "createdAt", "updatedAt" FROM "files";

-- AlterTable: link each file to its drop; its path is its name.
ALTER TABLE "files" ADD COLUMN "dropId" TEXT,
ADD COLUMN "path" TEXT;

UPDATE "files" SET "dropId" = "id", "path" = "filename";

ALTER TABLE "files" ALTER COLUMN "dropId" SET NOT NULL,
ALTER COLUMN "path" SET NOT NULL;

-- The expiry now lives on the drop.
DROP INDEX "files_expiresAt_idx";
ALTER TABLE "files" DROP COLUMN "expiresAt";

-- CreateIndex
CREATE INDEX "drops_expiresAt_idx" ON "drops"("expiresAt");

-- CreateIndex
CREATE INDEX "drops_consumedAt_idx" ON "drops"("consumedAt");

-- CreateIndex
CREATE UNIQUE INDEX "files_dropId_path_key" ON "files"("dropId", "path");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_dropId_fkey" FOREIGN KEY ("dropId") REFERENCES "drops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
