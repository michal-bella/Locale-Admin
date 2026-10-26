---
title: 'API: auth'
updated: 2026-10-26
notion_page_id:
---

# Autentifikácia (`/api/auth`)

Prihlásenie emailom a heslom alebo cez Google (OpenID Connect, [ADR 0009](../decisions/0009-google-login.md)), server-side session v Postgrese (tabuľka `Session`, viď [Databáza](../database.md#session)) a session cookie. Oba spôsoby vytvoria rovnakú session. Registrácia neexistuje: účet s heslom vytvára `ADMIN`, účet bez hesla vznikne pri prvom prihlásení cez Google. Heslo nastaví `ADMIN` ([reset hesla](./admin-users.md#put-apiadminusersidpassword)). Schémy sú v `packages/shared/src/auth.ts`.

| Metóda | Cesta                             | Prihlásenie | Popis                                         |
| ------ | --------------------------------- | ----------- | --------------------------------------------- |
| `POST` | `/api/auth/login`                 | nie         | prihlási používateľa a nastaví session cookie |
| `POST` | `/api/auth/logout`                | nie         | zmaže session a cookie (idempotentný)         |
| `GET`  | `/api/auth/me`                    | áno         | vráti prihláseného používateľa                |
| `GET`  | `/api/auth/providers`             | nie         | spôsoby prihlásenia okrem hesla               |
| `GET`  | `/api/auth/oauth/google`          | nie         | presmeruje na prihlásenie cez Google          |
| `GET`  | `/api/auth/oauth/google/callback` | nie         | návrat z Googlu: prihlási a presmeruje na `/` |

## Odpoveď `AuthUser`

Schéma `authUserSchema`. Rovnaké telo vracia `POST /api/auth/login` aj `GET /api/auth/me`. Hash hesla, token ani jeho hash sa nikdy nevracajú.

| Pole          | Typ                 | Popis                                                                                                                                                                                                                    |
| ------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`          | UUID                | ID používateľa                                                                                                                                                                                                           |
| `email`       | string              | normalizovaný email (malé písmená)                                                                                                                                                                                       |
| `role`        | `ADMIN` / `USER`    | globálna rola                                                                                                                                                                                                            |
| `firstName`   | string alebo `null` | meno, upravuje sa na obrazovke Môj profil ([`PATCH /api/profile`](./profile.md))                                                                                                                                         |
| `lastName`    | string alebo `null` | priezvisko                                                                                                                                                                                                               |
| `preferences` | objekt              | `{ translationsView: "EXTENDED" \| "COMPACT", translationsLayout: "COLUMNS" \| "STACKED" }`, zobrazenie a rozloženie stránky Preklady, mení [`PATCH /api/profile/preferences`](./profile.md#patch-apiprofilepreferences) |

```json
{
	"id": "6f1c0f8e-1b7e-4c47-9a53-0a4b1f3e2d11",
	"email": "meno@firma.sk",
	"role": "USER",
	"firstName": null,
	"lastName": null,
	"preferences": { "translationsView": "EXTENDED", "translationsLayout": "COLUMNS" }
}
```

## POST /api/auth/login

Telo (schéma `loginRequestSchema`):

```json
{ "email": "meno@firma.sk", "password": "••••••••" }
```

- `email` sa pred porovnaním upraví cez `trim()` a malé písmená, takže prihlásenie nezávisí od veľkosti písmen.
- `password` je iba povinné (1 až 128 znakov). Pravidlá nového hesla sa tu nekontrolujú, zlé heslo preto vráti 401, nie 400.
- Zlý email, zlé heslo, zablokovaný používateľ aj používateľ bez hesla (prihlasuje sa iba cez Google) vrátia rovnakú odpoveď 401 `AUTH_INVALID_CREDENTIALS`. Pri neexistujúcom emaile backend aj tak overí heslo voči falošnému hashu, aby sa odpovede nelíšili časom.
- Pri úspechu backend nastaví `User.lastLoginAt`, zmaže všetky expirované session (všetkých používateľov) aj session z cookie poslanej s požiadavkou (ak existuje), vytvorí novú session, pošle `Set-Cookie` a vráti `200` s `AuthUser`.

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

## GET /api/auth/providers

Vráti `200` s `{ "google": true }` (schéma `authProvidersResponseSchema`). `google` je `true`, keď má backend nastavené všetky ENV `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` a `GOOGLE_REDIRECT_URI` ([lokálny vývoj](../local-development.md)). Podľa neho prihlasovacia stránka zobrazí tlačidlo Google.

## Prihlásenie cez Google

Authorization Code flow s PKCE, `state` a `nonce` (knižnica `openid-client`, issuer `https://accounts.google.com`, scopes `openid email profile`). Oba endpointy sú navigácie prehliadača, nie XHR: odpovedajú presmerovaním, CSRF hlavičky nepotrebujú a bez `GOOGLE_*` ENV vrátia 404 `NOT_FOUND`.

### GET /api/auth/oauth/google

Vygeneruje PKCE verifier, `state` a `nonce`, uloží ich do cookie `locale_oauth` a presmeruje (`302`) na Google. Ak Google nie je dostupný (discovery zlyhá), presmeruje (`303`) na `/login?error=AUTH_OAUTH_FAILED`.

| Atribút cookie         | Hodnota                                               |
| ---------------------- | ----------------------------------------------------- |
| názov                  | `locale_oauth`                                        |
| `HttpOnly`, `SameSite` | áno, `Lax` (prehliadač ju pošle pri návrate z Googlu) |
| `Path`                 | `/api/auth/oauth`                                     |
| `Max-Age`              | 600 s                                                 |
| `Secure`               | podľa `COOKIE_SECURE`                                 |

### GET /api/auth/oauth/google/callback

Google sem vráti prehliadač s `code` a `state`. Backend zmaže cookie `locale_oauth`, overí odpoveď (`state`, PKCE, podpis a `nonce` ID tokenu) a nájde používateľa:

1. podľa Google ID (`User.googleSub`),
2. inak podľa overeného emailu: Google účet sa pripojí k existujúcemu používateľovi (aj s heslom, ten má potom oba spôsoby prihlásenia),
3. inak založí `USER` bez projektov a bez hesla. Kým ho `ADMIN` nepridá do projektu, vidí prázdny zoznam projektov.

Meno a priezvisko z Googlu (`given_name`, `family_name`) sa uložia iba vtedy, keď ich používateľ nemá. Email z Googlu sa neskôr neprepisuje (`ADMIN` ho môže zmeniť, väzba ostáva cez `googleSub`). Pri úspechu vznikne session ako pri hesle (nastaví `lastLoginAt`, zmaže expirované session a session z poslanej cookie), backend pošle `Set-Cookie` a presmeruje (`303`) na `/`.

Pri chybe presmeruje (`303`) na `/login?error=<code>` bez session:

| `code`                    | Kedy                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUTH_EMAIL_NOT_VERIFIED` | Google účet nemá overený email                                                                                                              |
| `AUTH_USER_BLOCKED`       | používateľ je zablokovaný (`isActive = false`)                                                                                              |
| `AUTH_ACCOUNT_CONFLICT`   | email patrí používateľovi s iným pripojeným Google účtom                                                                                    |
| `AUTH_OAUTH_FAILED`       | chýba alebo je neplatná cookie `locale_oauth`, nesedí `state`, používateľ prihlásenie zrušil, Google vrátil chybu alebo email nie je platný |

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

`requireRole(ROLE.ADMIN)` vráti 403 `FORBIDDEN` prihlásenému používateľovi bez požadovanej roly (neprihlásený dostane 401 už z `requireAuth`). Používajú ho všetky endpointy `/api/admin/*` (router `admin.routes.ts`, viď [admin-users.md](./admin-users.md)) a v projekte vytvorenie projektu, zmena nastavení, pridanie, odobratie a poradie jazykov, správa členov, úprava kľúča a import. `requireRole(ROLE.ADMIN, ROLE.EDITOR)` chráni uloženie prekladu a opustenie projektu: člen s rolou `VISITOR` preklady iba číta, filtruje a exportuje.

## CSRF

Jeden globálny middleware pre všetky `POST`, `PUT`, `PATCH` a `DELETE` požiadavky na backend (vrátane loginu a logoutu) vyžaduje:

- `Content-Type: application/json` (telo musí byť JSON, aj prázdne `{}`),
- hlavičku `X-Requested-With: XMLHttpRequest`.

Inak vráti 403 `CSRF_REJECTED` a telo sa ani neparsuje. `GET` požiadavky sa nekontrolujú a nemenia doménové dáta. Jedinou výnimkou je vlastná session volajúceho: `requireAuth` jej predĺži platnosť (sliding TTL) alebo ju zmaže po expirácii. CORS nie je zapnutý, cudzia stránka preto nemôže poslať požiadavku s vlastnou hlavičkou. FE axios inštancia hlavičku posiela a pri mutácii bez tela pridá `{}`.

## Rate limit

Iba `POST /api/auth/login` (prihlásenie cez Google rate limit nemá, overuje ho Google), kľúč je IP klienta (`trust proxy` = 1 hop, nginx alebo Vite). Úložisko je v pamäti backendu.

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
