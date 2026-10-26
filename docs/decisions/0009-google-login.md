---
title: '0009: Prihlásenie cez Google (OpenID Connect) popri hesle'
updated: 2026-10-26
notion_page_id:
---

# 0009: Prihlásenie cez Google (OpenID Connect) popri hesle

## Kontext

Každý účet dnes vytvára `ADMIN` s heslom, ktoré potom používateľ spravuje. Tím sa dohodol, že prihlásenie má riešiť OAuth 2 a aplikácia bude za VPN. Časť klientov však Google účet nemá. Plán: [`oauth-login`](../plans/oauth-login.md).

Alternatívy:

- **Iba OAuth, heslá zrušiť:** najmenej kódu, ale klient bez Google účtu sa neprihlási.
- **OAuth s whitelistom (doména alebo zoznam e-mailov):** kontrola, kto sa môže prihlásiť, ďalší zoznam na správu. Prístup k dátam aj tak dáva až členstvo v projekte.
- **OAuth bez whitelistu popri hesle** (zvolené): ktokoľvek na VPN sa prihlási cez Google a vznikne mu `USER` bez projektov; heslo ostáva pre ručne vytvorené účty.

## Rozhodnutie

Google OpenID Connect (Authorization Code flow s PKCE, `state` a `nonce`, knižnica `openid-client`). Po overení vznikne rovnaká DB session ako pri hesle (ADR 0004 platí ďalej). Účet je viazaný na Google ID (`User.googleSub`); pri prvom prihlásení sa podľa overeného e-mailu pripojí k existujúcemu účtu, inak sa založí `USER` bez projektov. Heslo je voliteľné (`User.passwordHash` nullable) a nastavuje ho `ADMIN` pri vytvorení alebo resete. `ADMIN` môže účet zablokovať (`User.isActive`). Google je zapnutý iba keď sú nastavené ENV `GOOGLE_*`.

## Dôsledky

- Prístup k dátam riadi iba členstvo v projekte; prihlásený človek bez členstva vidí prázdny zoznam projektov.
- Zmazaný používateľ sa po ďalšom Google prihlásení vráti ako nový `USER`; zamedzí tomu zablokovanie, nie zmazanie.
- Reset hesla adminom a zablokovanie zrušia session používateľa, zmena vlastného hesla odhlási ostatné zariadenia.
- Backend potrebuje odchádzajúci prístup na `accounts.google.com` a `oauth2.googleapis.com`.
- Google flow nemá E2E test; logiku pokrývajú integračné testy s falošným OIDC klientom.
