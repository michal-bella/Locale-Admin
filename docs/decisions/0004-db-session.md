---
title: '0004: Session v databáze namiesto JWT'
updated: 2026-10-16
notion_page_id:
---

# 0004: Session v databáze namiesto JWT

## Kontext

Aplikácia potrebuje prihlásenie pre interných používateľov s rolami `ADMIN` a `EDITOR`. FE a BE bežia na rovnakom origine (nginx, Vite proxy), máme jednu inštanciu BE a Postgres. Treba vedieť používateľa okamžite odhlásiť (logout, deaktivácia) a token nesmie byť dostupný z JavaScriptu.

Alternatívy:

- **JWT v `localStorage`**: jednoduché, ale token je dostupný z JS (XSS) a nedá sa zrušiť pred expiráciou.
- **JWT v httpOnly cookie**: rieši XSS, ale odhlásenie a deaktivácia potrebujú denylist v DB, čím sa stráca hlavná výhoda (bezstavovosť).
- **Server-side session v Postgrese**: každá požiadavka číta jeden riadok z DB, session sa dá kedykoľvek zmazať.

## Rozhodnutie

Server-side session v Postgrese (model `Session`) a náhodný token v httpOnly cookie `locale_session`.

- Token má 32 náhodných bajtov, v DB je iba jeho SHA-256 hash. Únik DB teda neprezradí platné cookie.
- Cookie: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` podľa `COOKIE_SECURE` (lokálne `false`, lebo Safari a Playwright WebKit cez http `Secure` cookie neuložia).
- Sliding TTL `SESSION_TTL_DAYS` (7 dní) s absolútnym limitom `SESSION_MAX_AGE_DAYS` (30 dní). DB sa zapisuje najviac raz za 5 minút a s každým zápisom príde nový `Set-Cookie` s `Max-Age`, aby prehliadač cookie nezahodil skôr ako DB.
- Expirované session sa mažú pri každom logine, cron netreba.
- CSRF: `SameSite=Lax` + povinné `Content-Type: application/json` a `X-Requested-With: XMLHttpRequest` na mutáciách, bez CORS.

## Dôsledky

- Každá autentifikovaná požiadavka robí jeden dotaz do DB (index na `tokenHash`). Pri jednej inštancii a malom počte používateľov je to zanedbateľné.
- Odhlásenie a deaktivácia platia okamžite.
- Pri viacerých inštanciách BE ostáva session v DB funkčná. Rate limit loginu je však v pamäti a pri viacerých inštanciách by potreboval zdieľané úložisko (napr. Redis).
