---
title: 'Prihlásenie cez Google popri hesle'
updated: 2026-10-26
notion_page_id:
---

# Prihlásenie cez Google

## Kontext

Dnes sa dá prihlásiť iba e-mailom a heslom a každého používateľa vytvára `ADMIN` v modáli Nový používateľ. Tento plán pridáva **prihlásenie cez Google (OpenID Connect)**. Prihlásenie heslom ostáva ako záloha, napr. pre klientov bez Google účtu, ktorým admin účet vytvorí ručne. Aplikácia beží za VPN.

K tomu pribúda reset hesla adminom, zablokovanie používateľa a odhlásenie ostatných zariadení pri zmene hesla.

## Rozhodnutia (potvrdené používateľom 2026-10-26)

| Otázka                                   | Rozhodnutie                                                                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Poskytovateľ                             | Google, typ aplikácie External (aj Gmail účty klientov). Scopes `openid email profile`.                                                         |
| Prihlásenie heslom                       | Ostáva bez zmeny. Účet s heslom vytvára `ADMIN` v modáli Nový používateľ ako dnes.                                                              |
| Kto sa môže prihlásiť cez Google         | Ktokoľvek (bez whitelistu). Prvé prihlásenie založí používateľa s globálnou rolou `USER` bez projektov; do projektov ho pridá `ADMIN`.            |
| Rovnaký e-mail s heslom aj cez Google    | Jeden účet: Google účet s overeným e-mailom sa pripojí k existujúcemu používateľovi s tým e-mailom.                                             |
| Heslo pre používateľa z Googlu           | Nastaví mu ho iba `ADMIN` cez reset hesla. Sám si ho nenastaví; bez hesla sa mu v profile nezobrazí Zmeniť heslo.                               |
| Reset hesla adminom                      | `ADMIN` zadá nové heslo; všetky session toho používateľa sa zrušia.                                                                             |
| Zmena vlastného hesla                    | Odhlási ostatné zariadenia, aktuálna session ostáva.                                                                                            |
| Zablokovanie                             | `ADMIN` môže používateľa zablokovať a odblokovať (`User.isActive`); zablokovaný sa neprihlási ani heslom, ani cez Google, jeho session sa zrušia. |
| Meno a priezvisko z Googlu               | Iba keď sú v profile prázdne.                                                                                                                   |
| Zmena e-mailu adminom                    | Ostáva. Google účet je viazaný na Google ID (`sub`), nie na e-mail, takže prihlásenie cez Google funguje ďalej.                                  |
| Odhlásenie                               | Iba z aplikácie, nie z Google účtu.                                                                                                             |
| Rate limit prihlásenia heslom            | Bez zmeny, kým sa nezistí, či VPN posiela všetkých pod jednou IP.                                                                               |
| E2E pre Google prihlásenie               | Teraz nie. Reset hesla a zablokovanie E2E majú.                                                                                                 |
| Dizajn prihlasovacej stránky             | Figma nie je: hore tlačidlo Prihlásiť sa cez Google, pod ním oddeľovač „alebo“ a súčasný formulár.                                              |
| Prostredia                               | Zatiaľ iba localhost (`5173` dev, `8080` Docker stack). Produkčná doména sa doplní neskôr.                                                       |

## Predpoklady (potvrdiť pri implementácii)

| Predpoklad                                                                                                                                                      | Prečo                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Google je zapnutý iba keď sú nastavené všetky tri ENV `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`; inak endpointy vrátia 404 a tlačidlo sa nezobrazí. | Implementácia a testy nečakajú na údaje od kolegu; ten istý image funguje s Googlom aj bez neho.                          |
| Knižnica `openid-client` v6 (panva): discovery `https://accounts.google.com`, PKCE, `state` a `nonce`.                                                           | Overená knižnica bez vlastnej kryptografie; Context7 docs v6.8.8.                                                          |
| `state`, `nonce` a PKCE verifier sú v krátkodobej httpOnly cookie `locale_oauth` (10 minút, `SameSite=Lax`, `Path=/api/auth/oauth`), zmazanej v callbacku.        | Netreba ďalšiu tabuľku; `Lax` cookie prehliadač pošle pri návrate z Googlu (top-level GET).                               |
| Po callbacku vznikne rovnaká DB session a cookie `locale_session` ako pri hesle (ADR 0004).                                                                     | `requireAuth`, CSRF a `/me` sa nemenia.                                                                                    |
| Chyby callbacku presmerujú na `/login?error=<ERROR_CODE>` a FE zobrazí preložený kód.                                                                           | Callback je navigácia prehliadača, nie XHR, takže JSON chyba by sa používateľovi zobrazila ako surový text.                |
| Google účet bez `email_verified` sa odmietne.                                                                                                                   | Pripájanie podľa e-mailu je bezpečné iba pri overenom e-maile.                                                             |
| Ak má používateľ s rovnakým e-mailom už pripojený iný Google účet (iné `sub`), prihlásenie sa odmietne (`AUTH_ACCOUNT_CONFLICT`).                                | Nemalo by nastať; radšej odmietnuť ako prepísať väzbu.                                                                    |
| Zablokovaný používateľ dostane pri Google prihlásení konkrétny kód `AUTH_USER_BLOCKED`; pri hesle ostáva `AUTH_INVALID_CREDENTIALS`.                              | Pri Google je identita overená, pri hesle by konkrétna chyba prezradila platnosť hesla.                                   |
| Admin nemôže zablokovať sám seba (409 `SELF_BLOCK`).                                                                                                             | Rovnako ako `SELF_DELETE`; vďaka tomu vždy ostane aspoň jeden aktívny admin.                                               |
| Callback URL pre `openid-client` sa skladá z `GOOGLE_REDIRECT_URI` a query z requestu, nie z `Host` hlavičky.                                                    | Za Vite proxy a nginx sa `Host` líši od adresy zaregistrovanej v Google.                                                   |
| Discovery sa robí pri prvom použití a výsledok sa drží v pamäti.                                                                                                | Backend naštartuje aj keď Google práve nie je dostupný.                                                                    |

## Zmeny

### packages/shared

- `GET /api/auth/providers` → `{ google: boolean }`.
- Chybové kódy `AUTH_USER_BLOCKED`, `AUTH_EMAIL_NOT_VERIFIED`, `AUTH_ACCOUNT_CONFLICT`, `AUTH_OAUTH_FAILED`, `SELF_BLOCK`.
- `AdminUser` a `AdminUserDetail`: `isActive`, `hasPassword`, `hasGoogle`, `lastLoginAt`.
- `UpdateUserRequest` prijme `isActive`; nový `PUT /api/admin/users/:id/password` s `{ password }` (`passwordSchema`).
- `Profile`: `hasPassword`, `passwordChangedAt` nullable.

### Databáza

- Migrácia `google_login`: `User.passwordHash` a `User.passwordChangedAt` nullable, nový `User.googleSub String? @unique`. Existujúce dáta sa nemenia.
- Seed sa nemení (admin s heslom).

### Backend

- ENV `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (voliteľné, všetky alebo žiadna); `.env.example` s prázdnymi hodnotami, odovzdanie do Docker stacku.
- OIDC klient ako závislosť `createApp(config, deps)`, aby ho integračné testy nahradili falošným.
- `GET /api/auth/oauth/google` (presmeruje na Google) a `GET /api/auth/oauth/google/callback` (overí odpoveď, nájde používateľa podľa `googleSub`, potom podľa e-mailu, inak založí `USER`; doplní meno a priezvisko, ak chýbajú; zmaže predchádzajúcu session ako login; nastaví cookie a presmeruje na `/`).
- Login heslom: používateľ bez hesla sa overí voči dummy hashu a dostane `AUTH_INVALID_CREDENTIALS`.
- `PUT /api/admin/users/:id/password`: nový hash, `passwordChangedAt`, zmaže všetky session používateľa (pri vlastnom účte okrem aktuálnej).
- `PATCH /api/admin/users/:id` s `isActive: false` zmaže session používateľa; `SELF_BLOCK` pre vlastný účet.
- `PUT /api/profile/password`: zmaže ostatné session používateľa; používateľ bez hesla dostane 409.
- Integračné testy: prvé prihlásenie založí `USER` bez projektov, opakované nájde podľa `sub`, pripojenie podľa e-mailu, neoverený e-mail, konflikt `sub`, zablokovaný používateľ, zlý `state`, meno sa neprepíše; Google vypnutý → 404; reset hesla zruší session; zablokovanie zruší session a zakáže oba spôsoby prihlásenia; zmena hesla odhlási ostatné session; login heslom pre účet bez hesla → 401.

### Frontend

- Prihlasovacia stránka: tlačidlo Prihlásiť sa cez Google (iba keď `providers.google`), oddeľovač „alebo“, formulár ako dnes; chyba z `?error=` ako `Alert`.
- Tabuľka Používatelia: stav Zablokovaný; detail používateľa: Nastaviť heslo (modál s heslom), Zablokovať / Odblokovať (potvrdzovací modál), spôsob prihlásenia (heslo, Google), posledné prihlásenie.
- Profil: sekcia Zabezpečenie so Zmeniť heslo iba keď `hasPassword`; inak informácia o prihlásení cez Google.
- i18n `sk`, `en`, `cs`; unit testy.

### Dokumentácia

`AGENTS.md` (doména: Member, prihlásenie), `docs/overview.md`, `docs/database.md`, `docs/api/auth.md`, `docs/api/admin-users.md`, `docs/api/profile.md`, `docs/local-development.md` (ENV a Google klient), `docs/changelog.md`, ADR 0009.

## Míľniky

1. **Kontrakt + DB + backend:** shared, migrácia, Google endpointy s falošným OIDC klientom v testoch, reset hesla, zablokovanie, odhlásenie ostatných session, integračné testy. Frontend iba toľko, aby prešiel `pnpm verify`.
2. **Frontend:** prihlasovacia stránka, detail a tabuľka používateľov, profil, i18n, unit testy. Overené v prehliadači; tlačidlo Google naozaj až s údajmi od kolegu.
3. **E2E + docs:** E2E pre reset hesla a zablokovanie, úprava existujúcich E2E na nové polia, dokumentácia, ADR 0009.
4. **Overenie so skutočným Googlom** (keď budú client ID a secret): prihlásenie na `localhost:5173` aj `localhost:8080`, pripojenie existujúceho účtu podľa e-mailu.

## Otvorené

- Robí VPN NAT pod jednu IP? Ak áno, rate limit hesla podľa e-mailu.
- Produkčná doména: redirect URI, authorized domain a stav publikovania In production v Google Cloud.

## Overenie

`pnpm verify`; integračné testy z backendu; v prehliadači: bez Google ENV sa tlačidlo nezobrazí, reset hesla odhlási používateľa v inom prehliadači, zablokovaný sa neprihlási, zmena hesla odhlási iné zariadenie; s údajmi od kolegu prvé prihlásenie cez Google ukáže prázdnu stránku „Zatiaľ nie ste v žiadnom projekte“.
