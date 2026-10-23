-- A sentence key with variables is now the placeholder reference for every language, the base included.
-- Clearing the flag makes seedPlaceholderWarnings recompute every cell with the new rule on the next start.
UPDATE "Translation" SET "placeholderWarning" = NULL;
