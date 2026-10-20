-- CreateEnum
CREATE TYPE "ACTIVITY_TYPE" AS ENUM ('PROJECT_CREATED', 'PROJECT_UPDATED', 'LANGUAGE_ADDED', 'LANGUAGE_REMOVED', 'BASE_LANGUAGE_CHANGED', 'MEMBER_ADDED', 'MEMBER_REMOVED', 'KEYS_IMPORTED', 'KEY_UPDATED', 'TRANSLATION_UPDATED');

-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID,
    "type" "ACTIVITY_TYPE" NOT NULL,
    "payload" JSONB NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityEvent_projectId_createdAt_idx" ON "ActivityEvent"("projectId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfills only the creation of existing projects (plan project-dashboard, decision 2); the creator is the earliest member.
INSERT INTO "ActivityEvent" ("id", "projectId", "userId", "type", "payload", "count", "createdAt")
SELECT
    gen_random_uuid(),
    project.id,
    (SELECT member."userId" FROM "ProjectMember" AS member WHERE member."projectId" = project.id ORDER BY member."createdAt" ASC, member."userId" ASC LIMIT 1),
    'PROJECT_CREATED',
    jsonb_build_object('name', project.name),
    1,
    project."createdAt"
FROM "Project" AS project;
