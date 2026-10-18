-- CreateTable
CREATE TABLE "ProjectLanguage" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "tag" TEXT NOT NULL,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectLanguage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLanguage_projectId_tag_key" ON "ProjectLanguage"("projectId", "tag");

-- At most one base language per project (partial unique index, not expressible in schema.prisma)
CREATE UNIQUE INDEX "ProjectLanguage_projectId_isBase_key" ON "ProjectLanguage"("projectId") WHERE "isBase";

-- AddForeignKey
ALTER TABLE "ProjectLanguage" ADD CONSTRAINT "ProjectLanguage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Languages were global until now: every existing project keeps all of them, including the base flag.
-- Names and flags are not copied, they come from the catalog in the code.
INSERT INTO "ProjectLanguage" ("id", "projectId", "tag", "isBase", "createdAt")
SELECT gen_random_uuid(), p."id", l."tag", l."isBase", l."createdAt"
FROM "Project" p CROSS JOIN "Language" l;

-- DropTable
DROP TABLE "Language";
