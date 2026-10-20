-- The translations search ignores diacritics ("vlastni" finds "vlastní"); trusted since PostgreSQL 13, so the database owner may create it.
CREATE EXTENSION IF NOT EXISTS unaccent;
