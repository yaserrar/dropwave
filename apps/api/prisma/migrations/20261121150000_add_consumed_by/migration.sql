-- How a burn-after-download drop was used up, so the purge job never deletes the
-- files of a zip that is still streaming.

-- CreateEnum
CREATE TYPE "DownloadKind" AS ENUM ('FILE', 'ZIP');

-- AlterTable
ALTER TABLE "drops" ADD COLUMN "consumedBy" "DownloadKind";
