-- CreateEnum
CREATE TYPE "PROJECT_ROLE" AS ENUM ('MANAGER', 'EDITOR', 'VISITOR');

-- AlterEnum
ALTER TYPE "ACTIVITY_TYPE" ADD VALUE 'MEMBER_ROLE_CHANGED' AFTER 'MEMBER_REMOVED';

-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN "role" "PROJECT_ROLE" NOT NULL DEFAULT 'EDITOR';

-- Every membership keeps the rights the user had through the global role (admins have no memberships).
UPDATE "ProjectMember" pm SET "role" = u.role::text::"PROJECT_ROLE" FROM "User" u WHERE pm."userId" = u.id AND u.role <> 'ADMIN';

-- AlterEnum: Postgres cannot drop enum values, so ROLE is recreated with ADMIN and USER.
CREATE TYPE "ROLE_new" AS ENUM ('ADMIN', 'USER');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "ROLE_new" USING (CASE WHEN "role" = 'ADMIN' THEN 'ADMIN' ELSE 'USER' END)::"ROLE_new";
DROP TYPE "ROLE";
ALTER TYPE "ROLE_new" RENAME TO "ROLE";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
