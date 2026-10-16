---
title: 'API: auth'
updated: 2026-10-16
notion_page_id:
---

# Autentifikácia (`/api/auth`)

Prihlásenie emailom a heslom, server-side session v Postgrese (tabuľka `Session`, viď [Databáza](../database.md#session)) a session cookie. Registrácia ani reset hesla vo fáze 1 nie sú. Schémy sú v `packages/shared/src/auth.ts`.

| Metóda | Cesta              | Prihlásenie | Popis                                         |
| ------ | ------------------ | ----------- | --------------------------------------------- |
| `POST` | `/api/auth/login`  | nie         | prihlási používateľa a nastaví session cookie |
| `POST` | `/api/auth/logout` | nie         | zmaže session a cookie (idempotentný)         |
| `GET`  | `/api/auth/me`     | áno         | vráti prihláseného používateľa                |

## Odpoveď `AuthUser`

Schéma `authUserSchema`. Rovnaké telo vracia `POST /api/auth/login` aj `GET /api/auth/me`. Hash hesla, token ani jeho hash sa nikdy nevracajú.

| Pole        | Typ                 | Popis                                      |
| ----------- | ------------------- | ------------------------------------------ |
| `id`        | UUID                | ID používateľa                             |
| `email`     | string              | normalizovaný email (malé písmená)         |
| `role`      | `ADMIN` / `EDITOR`  | globálna rola                              |
| `firstName` | string alebo `null` | meno, vyplní sa neskôr na obrazovke Profil |
| `lastName`  | string alebo `null` | priezvisko                                 |

```json
{ "id": "6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11", "email": "meno@firma.sk", "role": "EDITOR", "firstName": null, "lastName": null }
```

## POST /api/auth/login

Telo (schéma `loginRequestSchema`):

```json
{ "email": "meno@firma.sk", "password": "••••••••" }
```

- `email` sa pred porovnaním upraví cez `trim()` a malé písmená, takže prihlásenie nezávisí od veľkosti písmen.
- `password` je iba povinné (1 až 128 znakov). Pravidlá nového hesla sa tu nekontrolujú, zlé heslo preto vráti 401, nie 400.
- Zlý email, zlé heslo aj neaktívny používateľ vrátia rovnakú odpoveď 401 `AUTH_INVALID_CREDENTIALS`. Pri neexistujúcom emaile backend aj tak overí heslo voči falošnému hashu, aby sa odpovede nelíšili časom.
- Pri úspechu backend nastaví `User.lastLoginAt`, zmaže všetky expirované session (všetkých používateľov), vytvorí novú session, pošle `Set-Cookie` a vráti `200` s `AuthUser`.

| HTTP | `code`                     | Kedy                                          |
| ---- | -------------------------- | --------------------------------------------- |
| 200  |                            | prihlásenie úspešné, telo `AuthUser`          |
| 400  | `VALIDATION_ERROR`         | nevalidné telo, `details` podľa polí          |
| 401  | `AUTH_INVALID_CREDENTIALS` | zlý email alebo heslo, neaktívny používateľ   |
| 403  | `CSRF_REJECTED`            | chýba CSRF hlavička alebo JSON telo           |
| 429  | `RATE_LIMITED`             | prekročený rate limit, hlavička `Retry-After` |

## POST /api/auth/logout

Telo `{}` (kvôli CSRF kontrole musí byť JSON). Ak požiadavka obsahuje session cookie, backend zmaže jej riadok v `Session`. Vždy pošle `Set-Cookie`, ktorý cookie zmaže, a vráti `204` bez tela. Bez cookie alebo s neplatnou cookie vráti tiež `204`. Ostatné session toho istého používateľa (iné prehliadače) ostanú platné.

| HTTP | `code`          | Kedy                                    |
| ---- | --------------- | --------------------------------------- |
| 204  |                 | odhlásené (aj keď session neexistovala) |
| 403  | `CSRF_REJECTED` | chýba CSRF hlavička alebo JSON telo     |

## GET /api/auth/me

Vyžaduje platnú session cookie. Vráti `200` s `AuthUser`.

| HTTP | `code`                 | Kedy                                                                     |
| ---- | ---------------------- | ------------------------------------------------------------------------ |
| 200  |                        | prihlásený používateľ                                                    |
| 401  | `AUTH_UNAUTHENTICATED` | chýba cookie, neznámy token, session expirovala, používateľ je neaktívny |

## Session cookie

| Atribút    | Hodnota                                                           |
| ---------- | ----------------------------------------------------------------- |
| názov      | `locale_session`                                                  |
| hodnota    | náhodný token, 32 bajtov v base64url (43 znakov)                  |
| `HttpOnly` | áno, JavaScript na FE cookie nevidí                               |
| `SameSite` | `Lax`                                                             |
| `Path`     | `/`                                                               |
| `Secure`   | podľa ENV `COOKIE_SECURE` (default `true`, lokálne `false`)       |
| `Max-Age`  | zostávajúci čas do `expiresAt` session (spolu s ním aj `Expires`) |

V databáze je iba SHA-256 hash tokenu (`Session.tokenHash`), nie samotný token. Cookie hlavičky (`Cookie`, `Set-Cookie`) sa v logoch maskujú.

Pri logoute a pri neplatnej session backend cookie zmaže (`Set-Cookie` s prázdnou hodnotou a `Expires` v minulosti, rovnaké `Path`, `HttpOnly`, `SameSite`, `Secure`).

## Platnosť session (sliding TTL)

- Pri logine: `expiresAt = min(teraz + SESSION_TTL_DAYS, createdAt + SESSION_MAX_AGE_DAYS)`. Default 7 dní od poslednej aktivity, najviac 30 dní od prihlásenia.
- Pri každej požiadavke s prihlásením (`requireAuth`): ak od `lastUsedAt` prešlo aspoň 5 minút, backend nastaví `lastUsedAt = teraz`, prepočíta `expiresAt` rovnakým vzorcom a znova pošle `Set-Cookie` s novým `Max-Age`. Inak do DB nezapisuje a `Set-Cookie` neposiela. Interval 5 minút je konštanta `SESSION_TOUCH_INTERVAL_MS` v backende, nie ENV.
- Session, ktorej `expiresAt` uplynul alebo prekročila absolútny limit, vráti 401 `AUTH_UNAUTHENTICATED`, jej riadok sa zmaže a cookie sa zmaže. Rovnako sa zmaže session neaktívneho používateľa.
- Expirované session ostatných používateľov sa upratujú pri každom úspešnom logine. Cron netreba.

## Oprávnenia

`requireRole(ROLE.ADMIN)` vráti 403 `FORBIDDEN` prihlásenému používateľovi bez požadovanej roly (neprihlásený dostane 401 už z `requireAuth`). Vo fáze 1 ho použijú endpointy `/api/admin/*` (míľnik C).

## CSRF

Jeden globálny middleware pre všetky `POST`, `PUT`, `PATCH` a `DELETE` požiadavky na backend (vrátane loginu a logoutu) vyžaduje:

- `Content-Type: application/json` (telo musí byť JSON, aj prázdne `{}`),
- hlavičku `X-Requested-With: XMLHttpRequest`.

Inak vráti 403 `CSRF_REJECTED` a telo sa ani neparsuje. `GET` požiadavky sa nekontrolujú a nikdy nič nemenia. CORS nie je zapnutý, cudzia stránka preto nemôže poslať požiadavku s vlastnou hlavičkou. FE axios inštancia hlavičku posiela a pri mutácii bez tela pridá `{}`.

## Rate limit

Iba `POST /api/auth/login`, kľúč je IP klienta (`trust proxy` = 1 hop, nginx alebo Vite). Úložisko je v pamäti backendu.

- Limit `LOGIN_RATE_LIMIT_MAX` pokusov (default 10) za okno `LOGIN_RATE_LIMIT_WINDOW_MS` (default 900000 ms = 15 min).
- Počíta sa každý pokus, ktorý prejde CSRF kontrolou: úspešný, zlé heslo aj nevalidné telo.
- Po prekročení vráti 429 `RATE_LIMITED` s hlavičkou `Retry-After` (sekundy do konca okna). Odpovede nesú aj hlavičky `RateLimit` a `RateLimit-Policy` (IETF draft 8).

## Príklad (curl)

```bash
curl -i -c cookies.txt -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"email":"meno@firma.sk","password":"••••••••"}'
curl -i -b cookies.txt http://localhost:8080/api/auth/me
curl -i -b cookies.txt -X POST http://localhost:8080/api/auth/logout \
  -H 'Content-Type: application/json' -H 'X-Requested-With: XMLHttpRequest' -d '{}'
```
