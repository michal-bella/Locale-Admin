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

## Auth (milestone B)

Admin credentials: `michal.bella@goodrequest.com` and `SEED_ADMIN_PASSWORD` from `.env`. Build the body from `.env` so the password is never typed or printed:

```bash
BASE=http://localhost:8080/api
JAR=$(mktemp)
H=(-H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest')
LOGIN=$(python3 -c 'import json,sys; print(json.dumps({"email": "Michal.Bella@GoodRequest.com", "password": sys.argv[1]}))' "$(grep '^SEED_ADMIN_PASSWORD=' .env | cut -d= -f2-)")

curl -s -w '\n%{http_code}\n' -c $JAR -X POST $BASE/auth/login "${H[@]}" -d "$LOGIN"
# 200 {"id":"…","email":"michal.bella@goodrequest.com","role":"ADMIN","firstName":null,"lastName":null}
# (email is case-insensitive; Set-Cookie: locale_session=…; Max-Age=604799; Path=/; Expires=…; HttpOnly; SameSite=Lax)

curl -s -w '\n%{http_code}\n' -b $JAR $BASE/auth/me
# 200 same AuthUser

curl -s -o /dev/null -w '%{http_code}\n' -b $JAR -X POST $BASE/auth/logout "${H[@]}" -d '{}'
# 204

curl -s -w '\n%{http_code}\n' -b $JAR $BASE/auth/me
# 401 AUTH_UNAUTHENTICATED (the jar still holds the old token: the session row is gone)
```

## Error checks

```bash
curl -s -w '\n%{http_code}\n' $BASE/auth/me
# 401 AUTH_UNAUTHENTICATED

curl -s -w '\n%{http_code}\n' -X POST $BASE/auth/login "${H[@]}" -d '{"email":"michal.bella@goodrequest.com","password":"wrong-password"}'
# 401 AUTH_INVALID_CREDENTIALS

curl -s -w '\n%{http_code}\n' -X POST $BASE/auth/login "${H[@]}" -d '{"email":"nope","password":""}'
# 400 VALIDATION_ERROR, details [{"path":"email","code":"INVALID_EMAIL"},{"path":"password","code":"REQUIRED"}]

curl -s -w '\n%{http_code}\n' -X POST $BASE/auth/logout -H 'Content-Type: application/json' -d '{}'
# 403 CSRF_REJECTED (missing X-Requested-With)

curl -s -w '\n%{http_code}\n' -X POST $BASE/auth/login -H 'X-Requested-With: XMLHttpRequest' --data-urlencode 'email=a@b.sk'
# 403 CSRF_REJECTED (application/x-www-form-urlencoded)
```

## Admin users (milestone C)

Needs the admin `$JAR` from the Auth section (log in again after the logout step). Smoke users get the prefix `smoke-editor-` and are deleted at the end.

```bash
EMAIL="smoke-editor-$(date +%s)@example.com"; UP=$(echo "$EMAIL" | tr a-z A-Z); PW="smoke-pass-$RANDOM-x"

curl -s -w '\n%{http_code}\n' $BASE/admin/users
# 401 AUTH_UNAUTHENTICATED (no cookie)

curl -s -w '\n%{http_code}\n' -b $JAR -X POST $BASE/admin/users "${H[@]}" -d "{\"email\":\" $UP \",\"password\":\"$PW\",\"role\":\"ADMIN\"}"
# 201 {"id":"…","email":"smoke-editor-…@example.com","role":"EDITOR","createdAt":"…"} (email normalized, role ignored)

curl -s -w '\n%{http_code}\n' -b $JAR -X POST $BASE/admin/users "${H[@]}" -d "{\"email\":\"$UP\",\"password\":\"$PW\"}"
# 409 EMAIL_TAKEN (also for a different letter case)

curl -s -w '\n%{http_code}\n' -b $JAR -X POST $BASE/admin/users "${H[@]}" -d '{"email":"nope","password":"short"}'
# 400 VALIDATION_ERROR, details [{"path":"email","code":"INVALID_EMAIL"},{"path":"password","code":"TOO_SHORT","params":{"min":8}}]

curl -s -w '\n%{http_code}\n' -b $JAR $BASE/admin/users
# 200 {"users":[…]} newest first, no passwordHash

EJAR=$(mktemp)
curl -s -o /dev/null -c $EJAR -X POST $BASE/auth/login "${H[@]}" -d "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}"
curl -s -w '\n%{http_code}\n' -b $EJAR $BASE/admin/users
# 403 FORBIDDEN (EDITOR; same for POST)

docker compose exec -T db psql -U locale -d locale -c "DELETE FROM \"User\" WHERE email LIKE 'smoke-editor-%@example.com'"
```

macOS ships bash 3.2: use `tr` for upper case, not `${VAR^^}`.

### 429 rate limit

Destructive for the next 15 minutes of logins from your IP, so only run it on purpose. With the default `LOGIN_RATE_LIMIT_MAX=10`:

```bash
for i in $(seq 1 11); do curl -s -o /dev/null -D - -X POST $BASE/auth/login "${H[@]}" -d '{"email":"x@example.com","password":"x"}' | grep -iE '^(HTTP|retry-after)'; done
# 10x HTTP/1.1 401, then HTTP/1.1 429 + Retry-After: <seconds>
```

The limit lives in memory: `docker compose up -d --force-recreate backend` resets it.

## Mutations

All `POST`/`PUT`/`PATCH`/`DELETE` requests must send `Content-Type: application/json` and `X-Requested-With: XMLHttpRequest` (otherwise 403 `CSRF_REJECTED`), with `-d '{}'` when there is no body.
