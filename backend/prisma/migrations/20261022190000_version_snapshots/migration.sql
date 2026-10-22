-- Every version of a project holds its own copy of the keys (plan docs/plans/version-snapshots.md). Keys and cells of the label
-- model are not converted: the application is in development, the data is dropped and the seed creates the projects anew.
DELETE FROM "TranslationKey";

-- DropForeignKey
ALTER TABLE "Translation" DROP CONSTRAINT "Translation_versionId_fkey";

-- DropForeignKey
ALTER TABLE "TranslationKey" DROP CONSTRAINT "TranslationKey_versionId_fkey";

-- DropIndex
DROP INDEX "Translation_versionId_idx";

-- DropIndex
DROP INDEX "TranslationKey_projectId_namespace_name_key";

-- DropIndex
DROP INDEX "TranslationKey_versionId_idx";

-- AlterTable
ALTER TABLE "ProjectVersion" ADD COLUMN     "importedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Translation" DROP COLUMN "versionId";

-- AlterTable
ALTER TABLE "TranslationKey" ALTER COLUMN "versionId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "TranslationKey_projectId_idx" ON "TranslationKey"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TranslationKey_versionId_namespace_name_key" ON "TranslationKey"("versionId", "namespace", "name");

-- AddForeignKey
ALTER TABLE "TranslationKey" ADD CONSTRAINT "TranslationKey_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ProjectVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
