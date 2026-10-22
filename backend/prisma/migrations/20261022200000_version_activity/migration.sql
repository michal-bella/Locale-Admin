-- AlterEnum
ALTER TYPE "ACTIVITY_TYPE" ADD VALUE 'VERSION_DELETED';

-- AlterTable
ALTER TABLE "ActivityEvent" ADD COLUMN     "versionId" UUID;

-- CreateIndex
CREATE INDEX "ActivityEvent_versionId_idx" ON "ActivityEvent"("versionId");

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ProjectVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
