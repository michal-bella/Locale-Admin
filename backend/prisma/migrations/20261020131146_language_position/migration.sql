-- AlterTable
ALTER TABLE "ProjectLanguage" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- Keeps the order the page showed before: the base language first, then by tag.
UPDATE "ProjectLanguage" AS language
SET "position" = ordered.position
FROM (
    SELECT id, (ROW_NUMBER() OVER (PARTITION BY "projectId" ORDER BY "isBase" DESC, tag ASC) - 1)::INTEGER AS position
    FROM "ProjectLanguage"
) AS ordered
WHERE language.id = ordered.id;
