-- Load test data for the export (scripts/load/run-export.sh seed). Only for the throwaway locale-load database.
-- load-m: 5 000 keys x 9 languages (45 000 translations), load-l: 50 000 keys x 9 languages (450 000), the whole catalog.
-- Prisma creates ids in the app, so the SQL sets them. Values are ~130 characters with diacritics and a placeholder; every 10th non-base value is untranslated (deterministic).
\set ON_ERROR_STOP on

CREATE FUNCTION pg_temp.load_project(p_slug text, p_keys int) RETURNS void AS $$
DECLARE
	pid uuid := gen_random_uuid();
BEGIN
	DELETE FROM "Project" WHERE slug = p_slug;
	INSERT INTO "Project" (id, name, slug, "updatedAt") VALUES (pid, 'Load ' || p_slug, p_slug, now());
	INSERT INTO "ProjectMember" ("projectId", "userId") SELECT pid, id FROM "User" WHERE email = 'michal.bella@goodrequest.com';
	INSERT INTO "ProjectLanguage" (id, "projectId", tag, "isBase", position)
	SELECT gen_random_uuid(), pid, t.tag, t.tag = 'sk', t.ord - 1
	FROM unnest(ARRAY['sk', 'bg', 'cs', 'de-AT', 'en', 'hr', 'hu', 'ro', 'ru']) WITH ORDINALITY AS t(tag, ord);
	INSERT INTO "TranslationKey" (id, "projectId", namespace, name, "updatedAt")
	SELECT gen_random_uuid(), pid, (ARRAY['loc', 'notino-partner', 'paths', 'stoodio'])[1 + i % 4], 'Kľúč číslo ' || i || ' pre záťažový test exportu', now()
	FROM generate_series(1, p_keys) AS i;
	INSERT INTO "Translation" ("keyId", "languageId", value, "updatedAt")
	SELECT k.id, l.id,
		CASE WHEN NOT l."isBase" AND abs(hashtext(k.name || l.tag)) % 10 = 0 THEN NULL
		ELSE repeat('Prekladový text so znakmi á č ď é í ľ ň ó š ť ú ý ž {{count}} ', 2) || l.tag END,
		now()
	FROM "TranslationKey" k CROSS JOIN "ProjectLanguage" l
	WHERE k."projectId" = pid AND l."projectId" = pid;
END
$$ LANGUAGE plpgsql;

SELECT pg_temp.load_project('load-m', 5000);
SELECT pg_temp.load_project('load-l', 50000);
ANALYZE;

SELECT p.slug, count(DISTINCT k.id) AS keys, count(t.*) AS translations
FROM "Project" p JOIN "TranslationKey" k ON k."projectId" = p.id LEFT JOIN "Translation" t ON t."keyId" = k.id
WHERE p.slug LIKE 'load-%' GROUP BY p.slug ORDER BY p.slug;
