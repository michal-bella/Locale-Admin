-- CreateTable
CREATE TABLE "Language" (
    "id" UUID NOT NULL,
    "tag" TEXT NOT NULL,
    "englishName" TEXT NOT NULL,
    "nativeName" TEXT NOT NULL,
    "flagCode" TEXT NOT NULL,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Language_tag_key" ON "Language"("tag");

-- At most one base language (partial unique index, not expressible in schema.prisma)
CREATE UNIQUE INDEX "Language_isBase_key" ON "Language"("isBase") WHERE "isBase";
