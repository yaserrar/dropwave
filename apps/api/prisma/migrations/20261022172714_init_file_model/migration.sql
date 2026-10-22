-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'UPLOADED', 'EXPIRED', 'DELETED');

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_key_key" ON "files"("key");

-- CreateIndex
CREATE INDEX "files_status_createdAt_idx" ON "files"("status", "createdAt");

-- CreateIndex
CREATE INDEX "files_expiresAt_idx" ON "files"("expiresAt");
