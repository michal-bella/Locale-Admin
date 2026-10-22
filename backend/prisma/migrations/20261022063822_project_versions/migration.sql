-- CreateEnum
CREATE TYPE "VERSION_LOCK" AS ENUM ('AUTO', 'LOCKED', 'UNLOCKED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ACTIVITY_TYPE" ADD VALUE 'VERSION_CREATED';
ALTER TYPE "ACTIVITY_TYPE" ADD VALUE 'VERSION_UPDATED';

-- AlterTable
ALTER TABLE "Translation" ADD COLUMN     "versionId" UUID;

-- AlterTable
ALTER TABLE "TranslationKey" ADD COLUMN     "versionId" UUID;

-- CreateTable
CREATE TABLE "ProjectVersion" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" DATE NOT NULL,
    "endsAt" DATE NOT NULL,
    "lock" "VERSION_LOCK" NOT NULL DEFAULT 'AUTO',
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectVersion_projectId_startsAt_idx" ON "ProjectVersion"("projectId", "startsAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectVersion_projectId_name_key" ON "ProjectVersion"("projectId", "name");

-- CreateIndex
CREATE INDEX "Translation_versionId_idx" ON "Translation"("versionId");

-- CreateIndex
CREATE INDEX "TranslationKey_versionId_idx" ON "TranslationKey"("versionId");

-- AddForeignKey
ALTER TABLE "ProjectVersion" ADD CONSTRAINT "ProjectVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectVersion" ADD CONSTRAINT "ProjectVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranslationKey" ADD CONSTRAINT "TranslationKey_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ProjectVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Translation" ADD CONSTRAINT "Translation_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ProjectVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
