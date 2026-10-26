-- AlterTable
ALTER TABLE "User" ADD COLUMN     "googleSub" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL,
ALTER COLUMN "passwordChangedAt" DROP NOT NULL,
ALTER COLUMN "passwordChangedAt" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

