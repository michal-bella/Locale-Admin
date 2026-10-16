---
name: api-smoke
description: curl smoke tests of the Locale Admin API through nginx (localhost:8080), directly against the backend container (localhost:3001) or dev mode (localhost:3000). Use to quickly verify endpoints and the error contract after a change.
---

# API smoke tests

Prefer `http://localhost:8080/api` (production stack through nginx, same as the browser). `http://localhost:3001/api` hits the backend container directly.

## Milestone A

```bash
BASE=http://localhost:8080/api

curl -s -w '\n%{http_code}\n' $BASE/health
# 200 {"status":"ok","version":"…","db":{"status":"ok","latencyMs":1}}

curl -s -w '\n%{http_code}\n' $BASE/does-not-exist
# 404 {"error":{"code":"NOT_FOUND","message":"Route GET /api/does-not-exist not found"}}

curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost:8080/admin/users
# 200 text/html  (SPA fallback, not an nginx 404)
```

Every error body must match `{ error: { code, message, details? } }` with a `code` from `ERROR_CODE`.

## Mutations

All `POST`/`PUT`/`PATCH`/`DELETE` requests must send both headers (CSRF rule, enforced from milestone B):

```bash
curl -s -X POST $BASE/<endpoint> \
  -H 'Content-Type: application/json' \
  -H 'X-Requested-With: XMLHttpRequest' \
  -c /tmp/locale.cookies -b /tmp/locale.cookies \
  -d '{"key":"value"}'
```

Auth, 401/403/409/429 and CSRF checks are added here in milestone B.
