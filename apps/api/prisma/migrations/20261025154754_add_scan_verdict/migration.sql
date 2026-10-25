-- CreateEnum
CREATE TYPE "ScanVerdict" AS ENUM ('CLEAN', 'REJECTED');

-- AlterEnum
ALTER TYPE "FileStatus" ADD VALUE 'REMOVED';

-- AlterTable
ALTER TABLE "files" ADD COLUMN     "scanReason" TEXT,
ADD COLUMN     "scanVerdict" "ScanVerdict";
