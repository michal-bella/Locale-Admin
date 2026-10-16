# Locale Admin – inicializačný plán (Fáza 1)

## 0. Ako postupovať (pre agenta)

1. Najprv si prečítaj celý plán a vytvor **implementačný plán po krokoch** (sekcia 10). Nezačínaj kódiť, kým ho neschválim.
2. Pred použitím knižnice si over aktuálnu dokumentáciu a verziu (Context7 / oficiálne docs). Hlavne **Vite+**, **Prisma**, **Express 5**, **Mantine** a **Tailwind v4** majú breaking changes oproti starším verziám.
3. Ak je niečo nejasné alebo v rozpore, **zastav sa a opýtaj sa**. Netipuj potichu.
4. Po každom kroku spusti feedback loop (sekcia 7), aktualizuj dokumentáciu (sekcia 9) a krok uzavri až keď všetko prejde.
5. **Git:** v prázdnom priečinku urob `git init` (hlavná vetva `main`). Agenti commitujú do vlastných vetiev (sekcia 4), orchestrátor merguje. **Remote sa nenastavuje a nič sa nepushuje**, remote pridám sám.
6. Tento plán ulož do nového repa ako `docs/plans/phase-1.md` (prvý commit).
7. Podporované OS: **iba macOS a Linux**. Skripty sú bash, adaptéry používajú symlinky. Windows sa nerieši.

## 1. Cieľ aplikácie

Admin aplikácia na správu prekladov pre **organizácie** a ich **projekty**.

- **Organizácia** má viac projektov.
- **Projekt** = jeden prekladový sheet (napr. B2B admin, B2C iOS, B2C Android, web URLs).
- **Editori** prekladov upravujú preklady v projektoch.
- Registrácia neexistuje. Používateľov zakladá iba admin.

Fáza 1 rieši iba základ (sekcia 10). Organizácie, projekty a editor prekladov prídu v ďalších plánoch, ale doménové pojmy majú byť popísané v root `AGENTS.md` už teraz.

## 2. Technické parametre

### Monorepo

- **pnpm workspaces** (verzia zafixovaná cez `packageManager` v `package.json`), Node LTS zafixovaný v `.nvmrc`.
- Štruktúra:
  - `frontend/` – React app (workspace balík)
  - `backend/` – Express API (workspace balík)
  - `packages/shared/` – zdieľané zod schémy a typy (request/response DTO), aby FE a BE nemali duplicitné kontrakty (workspace balík)
  - `e2e/` – Playwright testy a smoke testy, **samostatný workspace balík** s vlastným `package.json` a `playwright.config.ts`
  - `docker/` – Dockerfiles, nginx konfigurácia, Postgres init skripty
  - `scripts/` – pomocné skripty (prostredie, DB, `agents/check-scope.sh`)
  - `docs/` – dokumentácia (sekcia 9)
  - `.agents/` – agenti, skills, workflows (sekcie 4–6)
- Globálne **ESLint + Prettier** (jedna konfigurácia v roote, moduly ju rozširujú). TypeScript strict všade.
- Root skripty: `dev`, `build`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `verify` (= lint + typecheck + secretlint + unit + integration), `db:up`, `db:down`, `db:migrate`, `db:seed`, `db:reset`, `stack:up`, `stack:down`, `stack:logs` (viď Režimy spúšťania).

### Docker

- `docker-compose.yml` v roote so službami `db` (Postgres), `backend`, `frontend`. Každá služba má **healthcheck**.
- Multi-stage `Dockerfile` pre `backend` aj `frontend`.
- **FE a BE bežia na rovnakom origine, CORS sa nepoužíva:**
  - `frontend` kontajner = **nginx**: servíruje zbuildovanú SPA (fallback `try_files ... /index.html`) a `/api/*` proxuje na `backend:3000` (vrátane hlavičiek `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`).
  - Porty na hoste: `frontend` → `http://localhost:8080` (jediný vstup pre prehliadač aj Playwright). `backend` → `localhost:3001` iba na debug a `api-smoke` (nie `3000`, aby nekolidoval s lokálnym `pnpm dev`). `db` → `localhost:${DB_PORT}`, kde `DB_PORT` je v `.env` (v `.env.example` **`5433`**, lebo `5432` býva obsadený Postgresom iných projektov, napr. Notino).
  - Vo vývojovom režime Vite dev server proxuje `/api` na `http://localhost:3000`, takže aj tam je jeden origin (viď nižšie).
  - Axios má `baseURL: '/api'`, žiadna absolútna URL BE vo FE kóde.
  - Express má `app.set('trust proxy', 1)`, aby správne čítal IP (rate limit) a protokol.
- Backend pri štarte spustí `prisma migrate deploy` a **seed** (idempotentný).
- Celá aplikácia vrátane DB musí ísť na čistom stroji spustiť dvoma príkazmi: `cp .env.example .env` a `docker compose up`.
  - `.env.example` obsahuje **platné lokálne hodnoty** vrátane dev hesla pre `SEED_ADMIN_PASSWORD` (spĺňa pravidlá hesla, jasne označené ako iba lokálne). Bez `.env` BE zámerne spadne.

### Režimy spúšťania

Sú dva režimy. Každý má jasný účel, nemiešajú sa.

| | **Vývojový režim** (každodenná práca) | **Produkčný stack** (overenie) |
|---|---|---|
| Spustenie | `pnpm db:up` + `pnpm dev` | `pnpm stack:up` (= `docker compose up -d --build --wait`) |
| DB | Docker (`docker compose up -d --wait db`) | Docker |
| BE | lokálne, `tsx watch` na `localhost:3000` | kontajner, `localhost:3001` |
| FE | lokálne, Vite+ dev server na `localhost:5173`, HMR | nginx so zbuildovanou SPA na `localhost:8080` |
| Hot reload | áno (FE aj BE) | nie |
| Migrácie a seed | `pnpm db:migrate` (`prisma migrate dev` + `pnpm db:seed`) | automaticky pri štarte BE (`prisma migrate deploy` + seed) |
| Na čo | vývoj, rýchle iterácie, unit a integračné testy | smoke testy, E2E testy, akceptačné kritériá |

- `pnpm dev` spustí FE aj BE paralelne jedným príkazom (pnpm `--parallel` / `-r`), zmena v `packages/shared` sa prejaví v oboch bez reštartu.
- Variant s `compose.dev.yml` (zdrojáky pripojené cez volume do kontajnerov) **nerobíme**. Na macOS je pomalý file watching a `node_modules` v kontajneri robia problémy. Ak ho bude treba, príde ako samostatné rozhodnutie (ADR).
- **Seed vo vývojovom režime:** `pnpm dev` (`tsx watch`) seed nespúšťa a novšie verzie Prismy ho nespúšťajú ani pri `migrate dev`. Preto existuje samostatný `pnpm db:seed` (ten istý seed ako v kontajneri) a volajú ho `db:migrate` aj `db:reset`. Prvé spustenie: `cp .env.example .env && pnpm db:up && pnpm db:migrate && pnpm dev`.
- Ďalšie skripty: `pnpm db:down`, `pnpm db:reset` (zmaže a znova vytvorí lokálnu DB vrátane seedu), `pnpm stack:down`, `pnpm stack:logs [služba]`.
- Pred `pnpm stack:up` netreba zastavovať `pnpm dev`, porty nekolidujú (FE 5173 vs 8080, BE 3000 vs 3001). Oba režimy zdieľajú tú istú DB v Dockeri.
- Postup oboch režimov popíš v `docs/local-development.md` a v skille `local-env`.

### Voči čomu bežia testy

- **Unit testy:** bez prostredia (Vitest).
- **Integračné testy BE:** voči samostatnej test DB `locale_test` v **tom istom Postgres kontajneri** (nie samostatná služba):
  - **Vytvorenie:** init skript `docker/postgres/init/01-create-test-db.sql` pripojený do `/docker-entrypoint-initdb.d`. Ten sa spustí iba pri prázdnom volume, preto test `globalSetup` DB navyše vytvorí, ak neexistuje (pripojí sa na `postgres` DB a skontroluje `pg_database`).
  - **Pripojenie:** `TEST_DATABASE_URL` v `.env.example`. Test runner ho nastaví ako `DATABASE_URL` pre Prisma klienta. **Poistka:** ak názov DB nekončí na `_test`, testy sa okamžite ukončia, aby nikdy nezmazali dev dáta.
  - **Migrácie:** raz na začiatku behu v `globalSetup` cez `prisma migrate deploy`.
  - **Čistenie:** pred každým testom `TRUNCATE` všetkých tabuliek okrem `_prisma_migrations` s `RESTART IDENTITY CASCADE`. Zoznam tabuliek sa číta z `pg_tables`, nie natvrdo, aby nové tabuľky nebolo treba dopisovať. Rollback transakcií nepoužívame, lebo s Prismou a Expressom (požiadavky cez supertest) je to krehké.
  - **Paralelizmus:** integračné testy bežia sériovo (Vitest `fileParallelism: false`), keďže zdieľajú jednu DB.
  - **Dáta:** testy nepoužívajú seed. Každý test si dáta vytvorí sám cez helpery (napr. `createUser({ role })`, `loginAs(user)`) v `backend/test/helpers/`.
- **Smoke a E2E testy (Playwright) a akceptačné kritériá:** vždy voči **produkčnému stacku** (`http://localhost:8080`). Iba to overí nginx proxy, cookie a produkčný build.
  - `pnpm test:e2e` stack **vždy** spustí alebo reštartuje so svojím ENV (`LOGIN_RATE_LIMIT_MAX=1000 docker compose up -d --build --wait --force-recreate backend frontend`). Nespolieha sa na stack, ktorý už beží s inými hodnotami.
  - Počas vývoja sa dá Playwright pustiť aj proti dev režimu cez `E2E_BASE_URL=http://localhost:5173`, ale krok je hotový až po prejdení voči produkčnému stacku.
  - E2E testy si vytvárajú vlastné dáta (unikátne emaily, napr. s timestampom) a nespoliehajú sa na prázdnu DB, keďže DB je zdieľaná s dev režimom.
- `.env.example` v roote. Reálne hodnoty iba v `.env` (gitignored). ENV premenné sa validujú zodom pri štarte BE.

### Frontend

- React + TypeScript
- **Vite+** (https://viteplus.dev/guide/). Ak by Vite+ blokoval prácu (alpha/bug/nekompatibilita), použi štandardný Vite a napíš mi prečo.
- TanStack Query (server state), axios (HTTP klient s jednou inštanciou a interceptormi)
- React Hook Form + zod (`@hookform/resolvers`), schémy z `packages/shared`
- **react-i18next**, kľúče v objektovej štruktúre `myPage.formName.fieldName`. Jazyky: `sk` (default) a `en`.
- **Mantine UI** prispôsobený Figme (theme: farby, typografia, radius). **Tailwind** iba na layout/spacing. Nastav CSS layers tak, aby Tailwind preflight nerozbil Mantine štýly.
- Routing: React Router (alebo TanStack Router – zdôvodni výber).
- Nepoužívaj lodash.
- E2E testy: Playwright.

#### Referenčný projekt (inšpirácia pre FE)

Lokálne na disku je projekt `~/REPOS/Notino-Landing-Monorepo` (hlavne `frontend/src/`). Slúži ako **vzor štruktúry a štýlu** FE kódu, aby nová aplikácia vyzerala a bola organizovaná podobne ako ostatné projekty tímu.

- **Iba na čítanie.** V tomto projekte nič nemeň, nespúšťaj v ňom príkazy a nekopíruj z neho `.env` ani secrets.
- **Čo prevziať:**
  - rozdelenie na `atoms/` (malé znovupoužiteľné prvky ako `Button`, `TextInput`, `Badge`, `Icon`, `Pagination`), `components/` (zložené komponenty, `Layout`) a sekcie/stránky
  - štruktúru priečinka komponentu (komponent, typy, štýly, export)
  - spôsob práce s Mantine (theme, prekrytie komponentov, notifikácie)
  - formuláre cez React Hook Form + zod a znovupoužiteľné form fieldy
  - prácu s TanStack Query a axios (hooks, query keys)
  - štýly: CSS premenné generované z theme, organizácia `styles/`
  - priečinky `hooks/`, `lib/`, `schemas/`, `types/`, `locales/`, generovanie ikon cez SVGR
  - pomenovanie súborov, exporty, ESLint/Prettier konfiguráciu
- **Čo NEprevziať** (referenčný projekt má iný stack):
  - Next.js (App/Pages router, server komponenty) → tu je Vite+ SPA
  - styled-components → tu Mantine + Tailwind
  - next-intl → tu react-i18next
  - GraphQL a codegen → tu REST cez axios
  - marketingové a tracking veci (dataLayer, reCAPTCHA, cookie consent, CMS sekcie)
- Pri každom rozdiele medzi referenčným projektom a týmto plánom má prednosť **tento plán**.
- Prevzaté konvencie zapíš do `frontend/AGENTS.md` a skillu `frontend-conventions` a stručne ich popíš v `docs/frontend.md`. Nové repo nesmie byť na referenčný projekt závislé, iba ho uveď ako zdroj inšpirácie.
- Ak agent nemá prístup k disku (napr. beží v cloude), zastav sa a vypýtaj si ukážky súborov.

### Backend

- Node + Express 5 + TypeScript
- Prisma ORM + PostgreSQL
- Validácia vstupov zodom (schémy z `packages/shared`)
- Express aplikácia sa vytvára cez `createApp(config)`. ENV sa číta a validuje iba v `server.ts` (vstupný bod), nie pri importe modulov. Integračné testy tak vedia vytvoriť aplikáciu s vlastnou konfiguráciou (napr. rate limit `max=3`). Patrí do skillu `backend-conventions`.
- Jednotný formát chybovej odpovede (viď **Chybový kontrakt** nižšie)
- Logovanie cez pino, `helmet`, rate limit na `/auth/login` (viď **Rate limit** nižšie)
- **Bez CORS middleware** (FE a BE sú na rovnakom origine cez nginx/Vite proxy, viď Docker)

### Autentifikácia a role

- Iba prihlásenie (bez registrácie a bez reset hesla vo Fáze 1).
- Heslá hashované cez **argon2** (alebo bcrypt). Nikdy neukladať plain text.
- Session: **server-side session uložená v Postgrese** (nie JWT). Neukladať token do `localStorage`.
  - Prisma model `Session`: `id`, `userId` (FK na `User`, `onDelete: Cascade`), `tokenHash`, `createdAt`, `lastUsedAt`, `expiresAt`.
  - Pri logine sa vygeneruje náhodný token (min. 32 bajtov), do cookie ide token a do DB iba jeho hash (SHA-256).
  - Cookie: `httpOnly`, `SameSite=Lax`, `Path=/`, `Secure` podľa ENV `COOKIE_SECURE` (default `true`). V `.env.example` aj v `docker-compose.yml` je `false`, lebo lokálny stack beží na `http://localhost:8080` a Safari aj Playwright WebKit cez http `Secure` cookie neuložia.
  - **TTL:** 7 dní od poslednej aktivity (sliding). Každá požiadavka posunie `expiresAt`, DB sa však zapisuje najviac raz za 5 minút. Absolútny limit je 30 dní od prihlásenia, potom treba nový login.
  - **Cookie sa posúva spolu s DB:** pri každom posune `expiresAt` BE znova pošle `Set-Cookie` s novým `Max-Age` = `min(TTL, zostatok do absolútneho limitu)`. Inak by prehliadač cookie zahodil po 7 dňoch od loginu bez ohľadu na DB.
  - Logout zmaže riadok v `Session` a cookie. Expirovaná session vráti 401 a jej riadok sa zmaže.
  - Expirované session sa upratujú pri každom logine (`DELETE ... WHERE expiresAt < now()`). Cron netreba.
  - TTL hodnoty sú v ENV (`SESSION_TTL_DAYS`, `SESSION_MAX_AGE_DAYS`) s uvedenými defaultmi.
  - Rozhodnutie zapíš ako ADR do `docs/decisions/`.
- **CSRF ochrana** (nutná pri session v cookie):
  - Cookie `SameSite=Lax` (viď vyššie).
  - `GET` endpointy nesmú nič meniť. `SameSite=Lax` posiela cookie pri navigácii z cudzej stránky práve na `GET`.
  - Všetky mutácie (`POST`, `PUT`, `PATCH`, `DELETE`) vrátane `/api/auth/login` a `/api/auth/logout` vyžadujú `Content-Type: application/json` **a** hlavičku `X-Requested-With: XMLHttpRequest`. Inak BE vráti **403** s kódom `CSRF_REJECTED`. Kontrolu robí jeden globálny Express middleware, nie každý endpoint zvlášť.
  - Axios inštancia na FE to rieši centrálne v request interceptore: posiela `X-Requested-With` a pri mutáciách bez tela nastaví telo `{}`. Axios totiž pri požiadavke bez tela `Content-Type` nepošle a napr. `POST /api/auth/logout` by inak vrátil `CSRF_REJECTED`.
  - CORS sa nezapína. Cudzia stránka preto nemôže poslať požiadavku s vlastnou hlavičkou, lebo prehliadač ju zastaví na preflighte.
- Role: `ADMIN`, `EDITOR`. Sú to **globálne** role v systéme. Role v projekte (Administrátor, Prekladateľ, Vývojár, Kontrolór z obrazovky Členovia vo Figme) sú iná vec a prídu s projektmi v ďalšej fáze.

### Model User

| Pole | Typ | Poznámka |
|---|---|---|
| `id` | UUID | PK |
| `email` | string, unique | vždy uložený normalizovaný: `trim()` + malé písmená. Normalizuje zod schéma v `packages/shared`, takže login aj vytvorenie sú case-insensitive |
| `passwordHash` | string | argon2, nikdy sa nevracia v API |
| `role` | enum `ADMIN` / `EDITOR` | default `EDITOR` |
| `firstName`, `lastName` | string, nullable | modál vo Fáze 1 ich nemá, vyplnia sa neskôr na obrazovke Profil. UI zobrazí meno, ak existuje, inak email |
| `isActive` | boolean | default `true`. Neaktívny user sa neprihlási (rovnaká chyba ako zlé heslo) a jeho session sa pri deaktivácii zmažú. UI na deaktiváciu vo Fáze 1 nie je |
| `lastLoginAt` | datetime, nullable | nastaví sa pri úspešnom logine |
| `passwordChangedAt` | datetime | pre text „Heslo bolo naposledy zmenené…“ na obrazovke Profil |
| `createdAt`, `updatedAt` | datetime | |

Ďalšie polia z obrazovky Profil (pracovná pozícia, jazyk rozhrania, e-mailové oznámenia, fotografia) sa vo Fáze 1 **nepridávajú**. Prídu spolu s obrazovkou Profil.

- `GET /api/auth/me` vracia `{ id, email, role, firstName, lastName }`.
- **Iniciály** (avatar v tabuľke aj v menu): z `firstName` + `lastName`, ak existujú (napr. „MK“), inak prvé dve písmená emailu veľkými (`martin.kovac@…` → „MA“, rovnako ako vo Figme). Jedna helper funkcia v `packages/shared` alebo `frontend/src/lib/`.

### Pravidlá hesla

- Jedna konštanta `PASSWORD_MIN_LENGTH = 8` a `PASSWORD_MAX_LENGTH = 128` v `packages/shared`. Platí pre formulár nového používateľa (FE aj BE) **aj pre seed**.
- Placeholder a chybová hláška berú hodnotu z konštanty cez i18n interpoláciu (`Min. {{min}} znakov`), nie natvrdo.
- Žiadne ďalšie pravidlá zložitosti (veľké písmená, čísla) vo Fáze 1.

### Seed admina

- Email `michal.bella@goodrequest.com`, heslo z ENV `SEED_ADMIN_PASSWORD` (nikdy natvrdo v repe).
- `SEED_ADMIN_PASSWORD` je **povinná**. Ak chýba alebo nespĺňa pravidlá hesla, BE pri štarte spadne s jasnou chybou (zod validácia ENV).
- Seed je idempotentný: ak admin s týmto emailom neexistuje, vytvorí ho. Ak existuje, **nemení nič** (ani heslo, ani rolu). Zmena `SEED_ADMIN_PASSWORD` v `.env` preto existujúceho admina neovplyvní. Lokálne sa admin obnoví cez `pnpm db:reset`.

### Chybový kontrakt

- Formát: `{ error: { code, message, details? } }`.
  - `code` je stabilný reťazec z enumu `ErrorCode` v `packages/shared`.
  - `message` je iba anglický text pre logy a vývojárov. **FE ho nikdy nezobrazuje.**
  - `details` pri validácii: `[{ path: 'email', code: 'INVALID_EMAIL' }]`.
  - Kódy validácie sú **vlastný enum `ValidationCode`** v `packages/shared` (napr. `REQUIRED`, `INVALID_EMAIL`, `TOO_SHORT`, `TOO_LONG`), nie interné kódy zodu (tie sa medzi zod v3 a v4 zmenili, napr. `invalid_email` → `invalid_format`). Mapovanie zod issue → `ValidationCode` je na jednom mieste v `packages/shared`. Pri `TOO_SHORT`/`TOO_LONG` sa posiela aj `params: { min }` / `{ max }`.
- FE preloží chybu iba podľa `code` cez i18n kľúč `errors.<CODE>` (napr. `errors.AUTH_INVALID_CREDENTIALS`), validačné chyby cez `validation.<CODE>`. Neznámy kód → `errors.UNKNOWN`.
- Test (unit) overí, že každý `ErrorCode` aj `ValidationCode` má preklad v `sk` aj `en`.

| HTTP | `code` | Kedy | Čo urobí FE |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | nevalidné telo požiadavky (zod) | chyby z `details` priradí k poliam formulára (`setError`) |
| 401 | `AUTH_INVALID_CREDENTIALS` | zlý email/heslo alebo neaktívny user | chyba vo formulári loginu |
| 401 | `AUTH_UNAUTHENTICATED` | chýba alebo expirovala session | presmerovanie na login (okrem samotného login formulára) |
| 403 | `FORBIDDEN` | prihlásený bez oprávnenia | stránka 403 |
| 403 | `CSRF_REJECTED` | chýba CSRF hlavička (viď vyššie) | všeobecná chybová notifikácia |
| 404 | `NOT_FOUND` | neexistujúci endpoint alebo záznam | FE route → stránka 404, API → notifikácia |
| 409 | `EMAIL_TAKEN` | email už existuje | chyba pri poli E-mail |
| 429 | `RATE_LIMITED` | prekročený rate limit, s hlavičkou `Retry-After` | chyba vo formulári s počtom sekúnd |
| 500 | `INTERNAL_ERROR` | neočakávaná chyba (detail iba v logu) | všeobecná chybová notifikácia |

Používame iba **400** pre validáciu, nie 422.

### Rate limit

- Iba `POST /api/auth/login`, kľúč = IP. Úložisko v pamäti (jedna inštancia BE).
- Nastaviteľné cez ENV: `LOGIN_RATE_LIMIT_MAX` (default `10`) a `LOGIN_RATE_LIMIT_WINDOW_MS` (default `900000` = 15 min). `docker-compose.yml` ich preberá z `.env` s týmito defaultmi.
- **E2E testy:**
  - `pnpm test:e2e` spúšťa stack s `LOGIN_RATE_LIMIT_MAX=1000`.
  - Playwright sa prihlási raz na rolu v setup projekte a ďalej používa uložený `storageState`, takže sa neprihlasuje v každom teste.
- Samotný rate limit overuje **integračný test** s nízkym limitom (napr. `max=3`): 4. pokus vráti 429 `RATE_LIMITED` s `Retry-After`.

### Figma

- Design: https://www.figma.com/design/8mjlOXj1MXEqGwkWlf83mZ/Admin-system-for-translations?node-id=0-1
- Login screen: node `5-2861`
- Stránka **Používatelia** (zoznam): node `28-2` – https://www.figma.com/design/8mjlOXj1MXEqGwkWlf83mZ/Admin-system-for-translations?node-id=28-2&m=dev
- Modál **Nový používateľ**: node `28-191` – https://www.figma.com/design/8mjlOXj1MXEqGwkWlf83mZ/Admin-system-for-translations?node-id=28-191&m=dev
- Agent číta Figmu cez Figma MCP. Ak MCP nie je k dispozícii, zastav sa a vypýtaj si screenshoty.

#### Typografia, farby a ikony

- **Font: DM Sans** (z Figmy: `font-family: "DM Sans"`, základný text 16px / 400 / line-height 24px, farba `#62748E`).
  - Hostuje sa **lokálne** cez npm balík `@fontsource-variable/dm-sans` (alebo `@fontsource/dm-sans`), nie cez Google Fonts CDN.
  - Font sa nastaví v Mantine theme (`fontFamily`, `headings.fontFamily`) a v Tailwind `--font-sans`.
  - Ak by sa font nedal nainštalovať, použi dočasne systémový sans-serif stack. Font sa dá neskôr vymeniť na jednom mieste.
- **Farby, radius, tiene:** Figma súbor **nemá premenné** (`get_variable_defs` vracia prázdny výsledok, dizajn bol zrejme naimportovaný z HTML, vrstvy sa volajú `Container`, `Label:margin` a pod.).
  - Hodnoty ber zo štýlov v `get_design_context` jednotlivých obrazoviek, nie odhadom zo screenshotu.
  - Ručne ich namapuj na škálu: šedé na `slate` z Tailwind v4 (napr. `#62748E` = `slate-500`), primárnu ružovú ako vlastnú 10-odtieňovú Mantine farbu.
  - Výsledok zapíš na jedno miesto (Mantine theme + CSS premenné) a mapovanie popíš v `docs/frontend.md`.
- **Ikony: exportované priamo z Figmy** ako SVG (Figma MCP, napr. `download_assets` / assety z `get_design_context`) a prevedené cez **SVGR** na React komponenty v `frontend/src/components/Icons/`, rovnako ako skript `generate-icons` v referenčnom projekte.
  - SVG v repe sa ukladajú do `frontend/src/assets/icons/`, generovanie spúšťa `pnpm --filter frontend generate-icons`.
  - Farba ikon cez `currentColor`, veľkosť cez prop.
  - Ak export z Figmy nefunguje, použi dočasne **Lucide** (`lucide-react`, ikony v dizajne majú rovnaký štýl) a napíš mi to.

#### Layout (Fáza 1)

Sidebar z Figmy sa vo Fáze 1 **nerobí**. Layout je jednoduchý:

- **Horná lišta je nový dizajn**, nie kópia Figmy. Vo Figme je na lište iba drobčeková navigácia, ikona pomoci `?` a zvonček, logo a používateľ sú v sidebare a prepínač jazyka tam nie je vôbec. Lišta Fázy 1 len **skladá existujúce prvky z Figmy** (logo, zvonček, avatar, farby, font, výška a okraj lišty z `28-2`):
  - vľavo logo „Locale“, vpravo prepínač jazyka **SK / EN**, ikona notifikácií (iba statická) a menu používateľa
  - **bez** drobčekov (nie je čo navigovať) a **bez** ikony `?` (nemá kam viesť). Prídu so sidebarom
  - Menu používateľa: iniciály a email z `GET /api/auth/me`, položka **Používatelia** (iba `ADMIN`, vedie na `/admin/users`) a **Odhlásiť**.
- **Obsah:** index stránka `/` je **prázdna** (blank page). Obsah príde v ďalších fázach.
- **Prepínač jazyka:** voľba sa ukladá do `localStorage` (kľúč napr. `locale`), default `sk`. Pri chybe prístupu k `localStorage` sa použije default. Zmena sa prejaví hneď bez reloadu.

#### Presmerovania

- Po prihlásení idú **ADMIN aj EDITOR na `/`** (prázdna index stránka).
- Pri 401 sa presmeruje na `/login` **bez** návratu na pôvodnú URL (`?redirect=` sa vo Fáze 1 nerobí).
- Prihlásený používateľ na `/login` je presmerovaný na `/`.

#### Stránky 403 a 404

Nie sú vo Figme. Navrhni ich **podľa existujúcich dizajnov**, hlavne login screenu (`5-2861`): rovnaký font, farby, logo, karta na stred, primárne tlačidlo.

- **404:** nadpis, krátky text, tlačidlo **Späť na úvod** (`/`).
- **403:** nadpis, text, že na stránku nemáš oprávnenie, tlačidlo **Späť na úvod**.
- Texty cez i18n, žiadne natvrdo.

#### Stránka Používatelia (Fáza 1)

Admin tu vidí všetkých používateľov a zakladá nových. Obsah stránky je podľa Figmy (`28-2`), **bez sidebaru**, vložený do layoutu Fázy 1 (horná lišta + obsah).

- **Route:** `/admin/users`, iba `ADMIN`. Vstup cez menu používateľa v hornej lište.
- **Hlavička:** nadpis „Používatelia“, podnadpis „Účty, ktoré majú prístup do systému.“, tlačidlo **Vytvoriť používateľa** (otvorí modál).
- **Tabuľka:** stĺpce **E-mail** (s avatarom z iniciál, viď Model User) a **Vytvorený**. Dátum cez `Intl.DateTimeFormat` podľa zvoleného jazyka (`sk-SK` → `12. 10. 2026`, `en-GB` → `12/10/2026`), bez dátumovej knižnice. Zoradené od najnovšieho. Bez stránkovania, vyhľadávania a akcií v riadku (editácia ani mazanie nie sú vo Fáze 1).
- **Stavy, ktoré nie sú vo Figme:** loading (Mantine skeleton), prázdny zoznam, chyba načítania. Urob ich jednoducho v štýle dizajnu.
- **Modál Nový používateľ:**
  - Polia **E-mail** (placeholder `meno@firma.sk`) a **Heslo** (placeholder „Min. 8 znakov“ z konštanty, viď Pravidlá hesla). Tlačidlá **Zrušiť** a **Vytvoriť používateľa**.
  - Validácia zodom zo `packages/shared` (rovnaká schéma na FE aj BE): platný email (normalizovaný), heslo podľa Pravidiel hesla.
  - Rola sa vo formulári nevyberá. Nový používateľ je vždy `EDITOR`.
  - Ak email už existuje, BE vráti **409** `EMAIL_TAKEN` a FE zobrazí chybu pri poli E-mail.
  - Po úspechu: zavrieť modál, resetovať formulár, invalidovať query so zoznamom, zobraziť Mantine notifikáciu.
  - Počas odosielania je tlačidlo v loading stave a nedá sa odoslať dvakrát.
- Všetky texty cez react-i18next (napr. `users.createModal.email.label`), žiadne natvrdo zapísané texty.

## 3. AGENTS.md hierarchia

- Root `AGENTS.md`: cieľ projektu, doménové pojmy, štruktúra repa, skripty, hard rules, odkazy na skills a agentov.
- `frontend/AGENTS.md`, `backend/AGENTS.md`, `packages/shared/AGENTS.md`: pravidlá konkrétneho modulu.
- Pravidlo patrí čo najbližšie k modulu, ktorého sa týka. Žiadna duplicita medzi úrovňami.
- `AGENTS.md` majú byť stručné (ideálne do ~150 riadkov). Detailné postupy patria do skills.

## 4. Agenti

Definície rolí ulož do `.agents/agents/<rola>.md`. Každý agent má: **zodpovednosť, vstupy, výstupy, povolené nástroje, povolené adresáre, čo nesmie robiť, kedy odovzdáva prácu**.

### Vlastníctvo súborov

| Rola | Smie meniť |
|---|---|
| **Orchestrátor** (hlavný agent) | root súbory a infra: `package.json`, `pnpm-workspace.yaml`, `docker-compose.yml`, `docker/`, `scripts/`, `.env.example`, root konfigurácie (ESLint, Prettier, TS, husky, commitlint, secretlint), root `AGENTS.md`, `.agents/`, tool adaptéry (`CLAUDE.md`, `.claude/`, …), `docs/` |
| **Frontend Developer** | `frontend/`, `packages/shared/`, `docs/` |
| **Backend Developer** | `backend/` (vrátane `backend/prisma/`), `packages/shared/`, `docs/` |
| **E2E Tester** | `e2e/`, `docs/testing.md`. Produkčný kód nemení, chyby reportuje |
| **Code Reviewer** | nič (read-only). Reviewuje diff voči pravidlám z `AGENTS.md` a skills, výstup je zoznam nálezov podľa stupnice nižšie |

- `pnpm-lock.yaml` smie meniť každý agent, ktorý pridá závislosť do svojho balíka. Konflikty v lockfile pri merge rieši orchestrátor znova spustením `pnpm install`, nie ručne.
- Ak agent potrebuje zmenu mimo svojich súborov (napr. novú ENV premennú v `.env.example`), napíše ju do handoff reportu a urobí ju orchestrátor.

### Obmedzenie na adresáre a paralelná práca

AI nástroje (napr. Claude Code) vedia subagentovi obmedziť **nástroje**, nie **adresáre**. Preto:

- Povolené adresáre sú v definícii agenta ako **inštrukcia**.
- Každý implementačný agent pracuje v **samostatnom git worktree a vetve** (napr. `agent/fe-<úloha>`, `agent/be-<úloha>`) vytvorenej z aktuálnej integračnej vetvy. Paralelní agenti si tak nevidia rozpracované zmeny a `git diff` ukazuje iba vlastnú prácu.
  - Vo worktree sa spustí `pnpm install` (pnpm store je zdieľaný, je to rýchle).
  - Stack v Dockeri a E2E spúšťa iba orchestrátor v hlavnom worktree po merge, aby sa porty nebili.
- Dodržanie sa **overuje skriptom** `scripts/agents/check-scope.sh <rola> <base>`: porovná `git diff --name-only <base>...HEAD` (iba commity danej vetvy) voči povoleným cestám roly a pri porušení skončí s chybou. Spúšťa ho orchestrátor pred merge vetvy agenta a Code Reviewer pri review. Porušenie = nález `high`.
- Tool-specific hook (napr. Claude Code `PreToolUse`) sa vo Fáze 1 **nerobí**. Ak sa neskôr pridá, iba zavolá ten istý skript.

### Stupnica závažnosti (Code Reviewer)

| Závažnosť | Definícia | Príklady | Blokuje dokončenie kroku |
|---|---|---|---|
| `high` | chyba, bezpečnostný problém, porušenie hard rule alebo kontraktu, nefunkčné akceptačné kritérium | únik `passwordHash` v API, chýbajúca kontrola roly, secret v kóde, zmena mimo povolených adresárov, padajúci test | áno |
| `medium` | funguje, ale porušuje konvencie projektu alebo chýba test/dokumentácia | natvrdo zapísaný text namiesto i18n, chýbajúci test pre nový endpoint, `docs/` nezodpovedá kódu | áno, ak sa nevyrieši alebo vedome neodloží s odôvodnením |
| `low` | štýl, pomenovanie, drobné zjednodušenie | názov premennej, duplicitný import | nie |

Každý nález má: závažnosť, súbor a riadok, popis problému, návrh opravy.

## 5. Subagent flow

Popíš ho v `.agents/workflows/feature.md`:

1. **Plán** – orchestrátor rozdelí úlohu, určí závislosti a kontrakt (zod schémy v `packages/shared` sa robia **ako prvé** a mergnú sa do integračnej vetvy pred paralelnou prácou).
2. **Paralelná implementácia** – FE a BE agent pracujú paralelne nad hotovým kontraktom, každý vo vlastnom worktree a vetve (sekcia 4), a svoju prácu commitujú.
3. **Handoff** – každý agent odovzdá krátky report: čo zmenil, ako to overil, čo ostáva otvorené, čo potrebuje od orchestrátora (root/infra zmeny).
4. **Integrácia** – orchestrátor spustí `check-scope.sh` pre každú vetvu, mergne ich do integračnej vetvy, spustí `pnpm verify` a celý stack v Dockeri.
5. **E2E** – E2E Tester spustí smoke + Playwright.
6. **Review** – Code Reviewer. Nálezy idú späť príslušnému agentovi. Opakuj, kým nie sú vyriešené.
7. **Dokumentácia** – agent, ktorý zmenu robil, aktualizuje príslušné súbory v `docs/` (sekcia 9). Code Reviewer kontroluje aj to, či dokumentácia zodpovedá kódu.

## 6. Skills

Formát Agent Skills (`.agents/skills/<name>/SKILL.md`). Vo Fáze 1 iba tieto:

- `frontend-conventions` – React, TanStack Query, RHF, i18n kľúče, Mantine + Tailwind, štruktúra atoms/components/pages podľa referenčného projektu (sekcia 2)
- `backend-conventions` – Express, štruktúra routes/controllers/services, chybový kontrakt, auth
- `database-migrations` – Prisma schéma, migrácie, seed, reset lokálnej DB
- `testing` – unit/integration/e2e, kde ktoré testy žijú, ako ich spustiť, test DB
- `project-standards` – lint, format, typecheck, naming, secrets kontrola
- `commit-messages` – Conventional Commits, commitlint
- `local-env` – oba režimy spúšťania, Docker Compose (štart/stop, stav, logy, rebuild, reset volume), seed, pripojenie k lokálnej DB a diagnostické SQL (**iba lokálna DB**), troubleshooting (port obsadený a `DB_PORT`, DB nedostupná, migrácia zlyhala, nginx proxy nefunguje, cookie sa neuloží a `COOKIE_SECURE`), práca s git worktree pre agentov
- `api-smoke` – curl/HTTP smoke testy BE (login, me, 401/403/404/409/429, CSRF)
- `figma-to-code` – ako čítať Figmu (premenné, assety), mapovať ju na Mantine theme a exportovať ikony cez SVGR
- `docs-update` – kedy a ako aktualizovať `docs/`, šablóny stránok, pravidlá formátu pre Notion (sekcia 9)

Pravidlá:

- **Žiadne prázdne kostry.** Skill vznikne až vtedy, keď obsahuje reálne príkazy a postupy overené na tomto repe.
- `add-endpoint` a `add-page` sa napíšu **až po prvej reálnej feature** v ďalšej fáze, podľa toho, ako sa naozaj robila.
- Ďalší skill pridaj iba vtedy, keď sa ten istý postup zopakuje a nepatrí do existujúceho skillu.

## 7. Feedback loops

Agent po každej zmene spustí podľa relevancie:

- `pnpm lint` a `pnpm typecheck`
- unit testy (Vitest)
- integračné testy BE (supertest voči **reálnej Postgres DB v Dockeri**, samostatná test DB)
- BE smoke testy cez REST API (skill `api-smoke`)
- FE smoke + E2E cez Playwright voči **reálne bežiacemu `docker compose up`**, nie voči mockom
- testy akceptačných kritérií (sekcia 10)
- **Code Reviewer agent** na konci

Agent musí vedieť (skripty v `scripts/` + popis v skills):

- spustiť / zastaviť celé prostredie
- skontrolovať stav a healthcheck služieb
- čítať logy jednotlivých kontajnerov
- overiť komunikáciu FE → BE → DB (`GET http://localhost:8080/api/health` cez nginx vracia aj stav DB)
- pozrieť dáta v Postgrese a spustiť diagnostické SQL
- vložiť alebo upraviť ad-hoc testovacie dáta
- diagnostikovať zlyhanie testov a prostredia

## 8. Nezávislosť od AI providera

- Zdroj pravdy: `AGENTS.md`, `.agents/agents/`, `.agents/skills/`, `.agents/workflows/`, `scripts/`.
- Tool-specific konfigurácia je iba **tenká adaptačná vrstva**:
  - Claude Code: `CLAUDE.md` obsahuje iba `@AGENTS.md`, `.claude/skills` je symlink na `.agents/skills`.
  - Claude Code subagenti: `.claude/agents/<rola>.md` potrebujú vlastný frontmatter (`name`, `description`, `tools`), nemôžu byť iba holý odkaz. Súbor má preto **iba frontmatter a jednu vetu** v tele: „Prečítaj a dodržuj `.agents/agents/<rola>.md`.“ Celý obsah roly je iba v `.agents/agents/`. `description` je jediná vec, ktorá sa opakuje, a musí sedieť s definíciou roly.
  - Cursor a Codex: spôsob, akým čítajú skills, agentov a `AGENTS.md`, sa medzi verziami mení. **Pred implementáciou adaptérov over aktuálnu dokumentáciu** a v README uveď, voči akej verzii nástroja to bolo overené.
- Žiadny obsah pravidiel sa nekopíruje do konfigurácií jednotlivých nástrojov.
- Popíš v README, ako adaptéry fungujú (iba macOS/Linux).

## 9. Dokumentácia (Markdown → Notion)

Agent priebežne generuje a udržiava projektovú dokumentáciu v Markdown súboroch v `docs/`. Keď prepojím Notion, tieto súbory sa budú synchronizovať do Notionu. **Zdroj pravdy je vždy `docs/` v repe**, Notion je iba kópia na čítanie.

### Štruktúra

- `docs/README.md` – index všetkých stránok
- `docs/overview.md` – čo aplikácia robí, doménové pojmy (organizácia, projekt, editor, role)
- `docs/architecture.md` – monorepo, FE ↔ BE ↔ DB, auth flow, Docker služby
- `docs/api/` – popis endpointov (request, response, chybové kódy podľa chybového kontraktu: 400, 401, 403 vrátane `CSRF_REJECTED`, 404, 409, 429, 500)
- `docs/database.md` – dátový model (Prisma), migrácie, seed
- `docs/frontend.md` – routing, layout, i18n, Mantine theme
- `docs/local-development.md` – spustenie cez Docker Compose, ENV premenné, troubleshooting
- `docs/testing.md` – typy testov a ako ich spustiť
- `docs/decisions/NNNN-<nazov>.md` – rozhodnutia (ADR), napr. výber routera, Vite+ vs Vite, DB session vs JWT
- `docs/changelog.md` – čo pribudlo v ktorej fáze
- `docs/plans/phase-N.md` – plány jednotlivých fáz (tento plán = `phase-1.md`). Do Notionu sa nesynchronizujú

### Pravidlá formátu (aby import do Notionu fungoval)

- Jeden súbor = jedna Notion stránka. Na začiatku YAML frontmatter: `title`, `updated` (dátum) a `notion_page_id` (zatiaľ prázdne, doplní sa pri prvej synchronizácii).
- Iba štandardný Markdown: nadpisy, zoznamy, tabuľky, code bloky, odkazy. Žiadne HTML a žiadne tool-specific rozšírenia.
- Diagramy ako Mermaid code bloky (Notion ich vie zobraziť).
- Odkazy medzi stránkami relatívne (`./api/auth.md`), aby sa dali pri synchronizácii preložiť na Notion odkazy.
- Žiadne secrets, heslá ani reálne dáta v dokumentácii.
- Jazyk dokumentácie: slovenčina.

### Kedy aktualizovať

- Každá zmena endpointu, dátového modelu, ENV premennej, Docker služby alebo dôležité rozhodnutie → aktualizuj príslušný súbor v rovnakom kroku ako kód.
- Dokumentácia `docs/` je pre ľudí (tím, PM). `AGENTS.md` a skills sú pre agentov. Neduplikuj obsah, iba odkazuj.

### Synchronizácia do Notionu (neskôr)

- Vo Fáze 1 sa **nič do Notionu neposiela**. Pripraví sa iba štruktúra `docs/` a frontmatter.
- Synchronizácia bude neskôr cez skill `notion-sync` (Notion MCP alebo skript nad Notion API). Musí byť provider-agnostic rovnako ako zvyšok harnessu (sekcia 8).

## 10. Fáza 1 – rozsah a akceptačné kritériá

### Rozsah

1. AI harness (sekcie 3–8)
2. Monorepo scaffolding (FE, BE, shared, lint, format, typecheck) vrátane git hookov:
   - **husky** + **lint-staged** (`pre-commit`: Prettier, ESLint na zmenených súboroch a kontrola secrets)
   - **commitlint** s `@commitlint/config-conventional` (`commit-msg` hook)
   - **secretlint** (`@secretlint/secretlint-rule-preset-recommend`) v `pre-commit` aj v `pnpm verify`. Je to npm balík, takže funguje bez inštalácie ďalšieho binárneho súboru (na rozdiel od gitleaks)
3. Docker Compose + Postgres + Prisma + migrácia `User` a `Session` + seed admina
4. BE: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET /api/admin/users` a `POST /api/admin/users` (iba ADMIN), `GET /api/health`
   - `GET /api/admin/users` vracia `id`, `email`, `role`, `createdAt`, nikdy `passwordHash`
5. FE:
   - login screen podľa Figmy (node `5-2861`)
   - layout bez sidebaru: horná lišta (logo, prepínač SK/EN, notifikácie, menu používateľa) a prázdna index stránka `/`. Po prihlásení ADMIN aj EDITOR skončia na `/` (sekcia 2 → Layout, Presmerovania)
   - DM Sans lokálne, ikony exportované z Figmy cez SVGR (sekcia 2 → Typografia, farby a ikony)
   - stránka **Používatelia** a modál **Nový používateľ** podľa Figmy (nodes `28-2`, `28-191`)
   - stránky 403 a 404 v štýle login screenu, presmerovanie na login pri 401
6. Testy a feedback loop skripty
7. Dokumentácia v `docs/` podľa sekcie 9

Mimo rozsahu Fázy 1: organizácie, projekty, editor prekladov, reset hesla, CI pipeline, synchronizácia do Notionu, nahrávanie súborov a obrázkov, AWS (S3, deploy). Nepridávaj na to závislosti, ENV premenné ani Docker služby (napr. MinIO/LocalStack).

### Akceptačné kritériá (Definition of Done)

- [ ] Na čistom stroji `cp .env.example .env && docker compose up` spustí DB, BE aj FE a všetky healthchecky sú zelené
- [ ] Na čistom stroji `cp .env.example .env && pnpm db:up && pnpm db:migrate && pnpm dev` spustí vývojový režim a admin sa vie prihlásiť. Zmena vo FE sa prejaví cez HMR a zmena v BE reštartne server bez ručného zásahu
- [ ] Sliding session posúva aj cookie: po posune `expiresAt` príde `Set-Cookie` s novým `Max-Age` (integračný test)
- [ ] Logout cez FE (axios, bez tela) prejde CSRF kontrolou
- [ ] Login a logout fungujú aj v Playwright **WebKit** voči `http://localhost:8080`
- [ ] Spustenie `pnpm test:e2e` pri už bežiacom `pnpm stack:up` (s default rate limitom) neskončí chybami 429
- [ ] Aplikácia funguje celá cez `http://localhost:8080`: login, `/api/*` cez nginx proxy, refresh na hlbokej route (napr. `/admin/users`) nevráti nginx 404
- [ ] Admin sa prihlási emailom `michal.bella@goodrequest.com` a heslom z `.env`
- [ ] Zlé heslo vráti 401 `AUTH_INVALID_CREDENTIALS` a FE zobrazí preklad z `errors.AUTH_INVALID_CREDENTIALS` (nie `message` z BE)
- [ ] Login s `Michal.Bella@GoodRequest.com` funguje (email je case-insensitive), `lastLoginAt` sa nastaví
- [ ] Každý `ErrorCode` aj `ValidationCode` má preklad v `sk` aj `en` (unit test)
- [ ] Dátum v tabuľke sa zobrazuje podľa zvoleného jazyka (SK aj EN)
- [ ] BE bez `SEED_ADMIN_PASSWORD` pri štarte spadne s jasnou chybou
- [ ] 429 `RATE_LIMITED` overený integračným testom, E2E testy rate limit nerozbije
- [ ] Admin vidí zoznam používateľov (E-mail, Vytvorený) a cez modál vytvorí nového. Ten sa objaví v zozname bez refreshu a vie sa prihlásiť
- [ ] Nevalidný email, heslo kratšie ako 8 znakov (400) a už existujúci email aj s inou veľkosťou písmen (409) zobrazia chybu pri poli
- [ ] Obsah stránky Používatelia (bez sidebaru) a modál vizuálne zodpovedajú Figme (`28-2`, `28-191`)
  - **Jednorazové manuálne porovnanie**, nie automatický test: agent urobí Playwright screenshot a screenshot z Figmy (`get_screenshot`), porovná ich a rozdiely vypíše v reporte. Finálne potvrdzujem ja. Automatický `toHaveScreenshot` sa nerobí, lebo dáta v zdieľanej DB sa medzi behmi menia.
  - **Povolené rozdiely:** chýbajúci sidebar, horná lišta Fázy 1, placeholder hesla „Min. 8 znakov“ (Figma má 6), iné dáta v tabuľke.
- [ ] `EDITOR` na `/admin/users` dostane 403 (BE aj FE)
- [ ] Neprihlásený používateľ na chránenej route je presmerovaný na login (401)
- [ ] Neexistujúca route zobrazí 404
- [ ] Po prihlásení ADMIN aj EDITOR skončia na `/`. ADMIN vidí v menu položku Používatelia, EDITOR nie
- [ ] Prepínač SK/EN zmení texty bez reloadu a voľba prežije refresh (`localStorage`)
- [ ] Aplikácia používa DM Sans z lokálneho balíka (v Network tabe žiadne požiadavky na Google Fonts)
- [ ] Session prežije refresh stránky, logout zmaže riadok v `Session` a ďalšia požiadavka s tou istou cookie vráti 401
- [ ] Session po uplynutí TTL vráti 401 (otestované integračným testom s posunutým `expiresAt`)
- [ ] Mutácia bez `X-Requested-With` alebo s iným `Content-Type` (napr. `application/x-www-form-urlencoded`) vráti 403 `CSRF_REJECTED` (integračný test aj `api-smoke`)
- [ ] `pnpm verify` prejde, Playwright E2E prejde voči bežiacemu Docker Compose
- [ ] Code Reviewer nemá otvorené nálezy `high`, nálezy `medium` sú vyriešené alebo odložené s odôvodnením (stupnica v sekcii 4)
- [ ] `scripts/agents/check-scope.sh` prejde pre vetvu každej roly, ktorá v kroku pracovala
- [ ] Žiadne heslá ani secrets v gite: secretlint prejde v `pnpm verify` a commit so zjavným secretom (napr. testovací AWS kľúč) zablokuje `pre-commit` hook
- [ ] Commit so správou mimo Conventional Commits (napr. `fix stuff`) zablokuje `commit-msg` hook
- [ ] `docs/` obsahuje všetky stránky zo sekcie 9 s frontmatterom a popisuje skutočný stav kódu

### Míľniky

Fáza 1 sa realizuje v troch míľnikoch, ideálne každý v novej session. Po každom míľniku sa agent zastaví a počká na pokyn.

| Míľnik | Obsah | Výsledok |
|---|---|---|
| **A: Základ** | kroky 1–3, `GET /api/health`, FE kostra (theme, DM Sans, i18n, router, stránka 404) | `docker compose up` je zelený, `/api/health` cez nginx vracia stav DB, FE zobrazí 404 v dizajne |
| **B: Prihlásenie** | session, CSRF, rate limit, chybový kontrakt, login/logout/me, login screen, horná lišta, prepínač jazyka, 401 a 403 | admin sa prihlási a odhlási, session prežije refresh, funguje aj vo WebKite |
| **C: Používatelia** | `GET`/`POST /api/admin/users`, stránka Používatelia a modál, 403 pre `EDITOR`, vizuálne porovnanie s Figmou, krok 6 | všetky akceptačné kritériá Fázy 1, finálny Code Review |

Akceptačné kritériá vyššie platia pre celú Fázu 1. Každý míľnik musí splniť tie, ktoré sa týkajú jeho obsahu.

### Odporúčané poradie krokov (s checkpointom po každom)

Dokumentácia v `docs/` sa dopĺňa priebežne v každom kroku, nie až na konci.

1. Harness kostra: `AGENTS.md` hierarchia, agenti, adaptéry, kostra `docs/` → review štruktúry. Skills sa v tomto kroku iba vymenujú, obsah dostanú v kroku, kde vznikne kód, ktorý popisujú
2. Monorepo + lint/format/typecheck → `pnpm lint && pnpm typecheck`
3. Docker + DB + Prisma + seed → `docker compose up`, healthcheck, SQL kontrola admina
4. BE auth + admin users → integračné testy + `api-smoke`
5. FE login, layout, admin users, 403/404 → Playwright
6. Doplnenie skills o reálne príkazy z implementácie, kontrola `docs/` voči kódu → finálny Code Review
