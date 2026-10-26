---
title: 'Lokálny vývoj'
updated: 2026-10-20
notion_page_id:
---

# Lokálny vývoj

## Požiadavky

- macOS alebo Linux
- Docker Desktop (alebo Docker Engine s Compose v2)
- Node podľa `.nvmrc` (`nvm use`)
- pnpm cez corepack (`corepack enable`), verzia je zafixovaná v `package.json` (`packageManager`)

## Prvé spustenie

```bash
cp .env.example .env
pnpm install
```

`.env.example` obsahuje iba lokálne hodnoty (vrátane dev hesla admina), takže po skopírovaní všetko funguje bez úprav.

## Dva režimy

|                 | Vývojový režim                                | Produkčný stack                                    |
| --------------- | --------------------------------------------- | -------------------------------------------------- |
| Spustenie       | `pnpm db:up && pnpm db:migrate && pnpm dev`   | `pnpm stack:up`                                    |
| DB              | Docker, `localhost:5433`                      | Docker, `localhost:5433`                           |
| BE              | lokálne, `tsx watch`, `http://localhost:4000` | kontajner, `http://localhost:3001` (iba debug)     |
| FE              | lokálne, Vite+ s HMR, `http://localhost:5173` | nginx so zbuildovanou SPA, `http://localhost:8080` |
| Migrácie a seed | `pnpm db:migrate` (spustí aj seed)            | automaticky pri štarte BE kontajnera               |
| Na čo           | každodenný vývoj, unit a integračné testy     | smoke testy, E2E, akceptačné kritériá              |

Oba režimy zdieľajú tú istú DB. Porty sa nebijú, takže môžu bežať naraz.

Všetky checkouty (hlavný aj git worktree) používajú ten istý compose projekt `locale-admin`, teda aj ten istý kontajner `locale-admin-db-1`. Konfigurácia `db` sa medzi checkoutmi líši (absolútna cesta bind mountu `./docker/postgres/init`), takže obyčajné `docker compose up db` z iného checkoutu kontajner znova vytvorí a Postgres spadne uprostred behu iného checkoutu (Prisma `57P03 the database system is shutting down`, stovky 500). Preto `pnpm db:up`, `pnpm stack:up` aj `pnpm test:e2e` spúšťajú `db` s `--no-recreate`: bežiaci kontajner nechajú tak, chýbajúci alebo zastavený spustia. Zmena konfigurácie `db` (napr. image) sa preto neaplikuje sama, treba `docker compose up -d --wait --force-recreate db` (dáta ostanú vo volume). Porty DB (`5433`) a BE kontajnera (`3001`) sú dostupné iba z `localhost`, nie z lokálnej siete.

FE aj BE sú v oboch režimoch na jednom origine: vo vývoji Vite proxy presmeruje `/api` na `127.0.0.1:4000` (port 4000, lebo 3000 až 3003 bývajú obsadené inými FE projektmi; `127.0.0.1`, lebo dev backend počúva iba na IPv4 a `localhost` sa v Node najprv preloží na IPv6 `::1`, kde môže na rovnakom porte počúvať iná aplikácia; cieľ zmení premenná `VITE_API_PROXY_TARGET`, napr. keď port 4000 drží backend iného checkoutu; konfigurácia `frontend-5175-api3100` v `.claude/launch.json` tak spustí druhý FE na porte 5175 proti backendu na 3100), v stacku nginx presmeruje `/api` na kontajner `backend`. Pri `NODE_ENV=development` počúva BE iba na `127.0.0.1`, z iného zariadenia v sieti nie je dostupný (inak by šlo obísť rate limit loginu podvrhnutým `X-Forwarded-For`).

```mermaid
flowchart LR
  subgraph dev[Vývojový režim]
    B1[Prehliadač] -->|:5173| V[Vite+ dev server]
    V -->|/api proxy| BE1[tsx watch :4000]
  end
  subgraph stack[Produkčný stack]
    B2[Prehliadač / Playwright] -->|:8080| N[nginx]
    N -->|/api proxy| BE2[backend kontajner :3000]
  end
  BE1 --> DB[(Postgres :5433)]
  BE2 --> DB
```

## Príkazy

| Príkaz                        | Čo robí                                                    |
| ----------------------------- | ---------------------------------------------------------- |
| `pnpm db:up` / `pnpm db:down` | spustí / zastaví Postgres (bežiaci kontajner nereštartuje) |
| `pnpm db:migrate`             | `prisma migrate dev` + seed                                |
| `pnpm db:seed`                | iba seed (idempotentný)                                    |
| `pnpm db:reset`               | zmaže DB, aplikuje migrácie a spustí seed                  |
| `pnpm stack:up`               | zbuilduje a spustí celý stack, čaká na zelené healthchecky |
| `pnpm stack:down`             | zastaví stack (dáta v DB ostanú)                           |
| `pnpm stack:logs [služba]`    | logy (`db`, `backend`, `frontend`)                         |

## ENV premenné

| Premenná                                            | Kde              | Popis                                                                                                                                                                     |
| --------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DB_PORT`                                           | compose          | port Postgresu na hoste (default `5433`, `5432` býva obsadený)                                                                                                            |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | compose          | prístup do lokálnej DB                                                                                                                                                    |
| `DATABASE_URL`                                      | BE, Prisma       | pripojenie k DB z hosta. V kontajneri ho compose prepíše na host `db`                                                                                                     |
| `TEST_DATABASE_URL`                                 | integračné testy | test DB, názov musí končiť na `_test`                                                                                                                                     |
| `NODE_ENV`, `PORT`, `LOG_LEVEL`                     | BE               | prostredie, port, úroveň logovania                                                                                                                                        |
| `SEED_ADMIN_PASSWORD`                               | BE, seed         | heslo admina pre seed, povinné, min. 8 znakov                                                                                                                             |
| `APP_VERSION`                                       | BE               | verzia v odpovedi `GET /api/health`, nepovinná (default `0.0.0`)                                                                                                          |
| `COOKIE_SECURE`                                     | BE               | `Secure` príznak session cookie. Default `true`, v `.env.example` a compose `false` (lokálne http)                                                                        |
| `SESSION_TTL_DAYS`                                  | BE               | platnosť session od poslednej aktivity v dňoch (default `7`)                                                                                                              |
| `SESSION_MAX_AGE_DAYS`                              | BE               | absolútny limit session od prihlásenia v dňoch (default `30`)                                                                                                             |
| `LOGIN_RATE_LIMIT_MAX`                              | BE               | počet pokusov o login z jednej IP za okno (default `10`, `pnpm test:e2e` používa `1000`)                                                                                  |
| `LOGIN_RATE_LIMIT_WINDOW_MS`                        | BE               | dĺžka okna rate limitu v ms (default `900000` = 15 min)                                                                                                                   |
| `EXPORT_MAX_CONCURRENT`                             | BE               | počet exportov, ktoré bežia naraz v jednom procese (pode), default `2` ([export](./api/exports.md#súbežné-exporty))                                                       |
| `EXPORT_QUEUE_MAX`                                  | BE               | koľko exportov môže čakať vo fronte, default `20`; plná fronta → 429 `EXPORT_BUSY`                                                                                        |
| `EXPORT_QUEUE_TIMEOUT_MS`                           | BE               | najdlhšie čakanie vo fronte v ms, default `10000`; potom 429                                                                                                              |
| `EXPORT_TIMEOUT_MS`                                 | BE               | najdlhší export v ms vrátane sťahovania, default `60000`; potom backend zavrie spojenie a export skončí                                                                   |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`          | BE, compose      | OAuth klient z Google Cloud Console (Web application). Nepovinné; bez nich je prihlásenie cez Google vypnuté. Secret iba v `.env`                                         |
| `GOOGLE_REDIRECT_URI`                               | BE               | callback v dev režime, `http://localhost:5173/api/auth/oauth/google/callback`; musí byť medzi Authorized redirect URIs klienta. Nastav všetky tri `GOOGLE_*` alebo žiadnu |
| `GOOGLE_STACK_REDIRECT_URI`                         | compose          | callback v Docker stacku, `http://localhost:8080/api/auth/oauth/google/callback`; compose ho odovzdá backendu ako `GOOGLE_REDIRECT_URI`                                   |

## Troubleshooting

| Problém                                          | Riešenie                                                                                                                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Missing .env`                                   | `cp .env.example .env`                                                                                                                                                                    |
| port `5433` je obsadený                          | zmeň `DB_PORT` v `.env` a port v `DATABASE_URL` / `TEST_DATABASE_URL`                                                                                                                     |
| BE nenaštartuje: chyba ENV                       | chýba alebo je neplatná premenná, napr. `SEED_ADMIN_PASSWORD`; chyba vypíše jej názov                                                                                                     |
| `docker compose up` čaká na `backend`            | `pnpm stack:logs backend`, najčastejšie migrácia alebo pripojenie k DB                                                                                                                    |
| refresh na hlbokej route vráti 404               | nginx nemá SPA fallback, skontroluj `docker/nginx/default.conf`                                                                                                                           |
| test DB neexistuje                               | vytvorí ju `globalSetup` integračných testov, prípadne `pnpm db:down` a zmazanie volume                                                                                                   |
| po prihlásení sa cookie neuloží (stále `/login`) | cez http musí byť `COOKIE_SECURE=false` v `.env` (Safari a WebKit `Secure` cookie cez http zahodia)                                                                                       |
| login vracia 429                                 | prekročený `LOGIN_RATE_LIMIT_MAX`; počkaj `Retry-After` sekúnd alebo reštartuj backend (limit je v pamäti)                                                                                |
| testy padajú na `57P03` / stovky 500 naraz       | Postgres reštartoval iný checkout; `docker inspect locale-admin-db-1 --format '{{.State.StartedAt}}'`. Skripty `db` znova nevytvárajú, priame `docker compose up` bez `--no-recreate` áno |
