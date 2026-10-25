-- AlterEnum
ALTER TYPE "ROLE" ADD VALUE 'MANAGER' BEFORE 'EDITOR';

-- An ADMIN works in every project without a membership, so existing memberships of admins are dropped.
DELETE FROM "ProjectMember" pm USING "User" u WHERE pm."userId" = u.id AND u.role = 'ADMIN';
