---
title: '0006: Verzia prekladov ako štítok s dátumami, nie vetva'
updated: 2026-10-22
notion_page_id:
---

# 0006: Verzia prekladov ako štítok s dátumami, nie vetva

## Kontext

Tím vydáva aplikácie v mesačných sprintoch: verzia v kóde (`Admin 2.45`), deň code freeze (vývojári dodajú nové kľúče) a deň „end of copy + translation“ (editori preklady dokončia, vývojári ich syncujú do release vetvy). Locale Admin verzie nepoznal: export vrátil aj kľúče pre budúci sprint a nič nebránilo editorovi meniť preklady, ktoré už boli v kóde nasadenej verzie. Plán: [`translation-versions`](../plans/translation-versions.md).

Alternatívy:

- **Plné vetvy** (kópia kľúčov a hodnôt per verzia, zlučovanie zmien s konfliktmi, ako Tolgee branches): presne kopíruje git flow, ale znásobí každý dopyt o `versionId`, editori pracujú vo viacerých tabuľkách a niekto musí po hotfixe zlučovať. Tím nič z toho nepotrebuje: vývoj beží v jednej vetve a release vetvy sa odrezávajú podľa dátumu.
- **Kľúč so `sinceVersion` bez dátumov**: najmenší zásah, ale nevie zamraziť nasadenú verziu ani povedať editorom, dokedy majú čas.
- **Štítok s dátumami** (zvolené): tabuľka `ProjectVersion` s názvom a dvoma dátumami; kľúč nesie verziu, v ktorej vznikol, bunka verziu, v ktorej bola hodnota naposledy zapísaná.

## Rozhodnutie

`ProjectVersion` je pomenované časové okno projektu, žiadne kopírovanie dát. Filter Verzia v zozname prekladov ukáže zmeny verzie (kľúče vzniknuté vo verzii a bunky zmenené v nej), export so zvolenou verziou vráti celý stav projektu k nej (kľúče bez verzie a verzií so `startsAt` najneskôr ako zvolená), voliteľne iba jej zmeny.

Uzamknutie robí z verzie zdroj pravdy toho, čo je v kóde: automaticky po `endsAt` (`lock = AUTO`), `ADMIN` môže kedykoľvek ručne odomknúť (`UNLOCKED`, dodatočné úpravy po termíne) a znova zamknúť (`LOCKED`). Do uzamknutej verzie zapisuje iba `ADMIN`; `EDITOR` a `VISITOR` dostanú 409 `PROJECT_VERSION_LOCKED`. Verzia sa nikdy nemaže (`Restrict` z kľúčov a buniek), chyba v názve alebo dátumoch sa opraví cez `PATCH`. Projekt bez verzií funguje ako predtým; aktuálna verzia (dnešok medzi dátumami) sa odvodzuje, nikde sa neprepína.

## Dôsledky

- Každý zápis kľúča alebo bunky prechádza cez `resolveVersionId` (verzia z požiadavky, inak aktuálna podľa dátumu, kontrola uzamknutia podľa roly) a ukladá `versionId`; nezmenená bunka si verziu ponechá.
- Dátumy sú kalendárne dni (`DATE`), „dnes“ je dátum servera; čas dňa a časové pásmo sa neriešia.
- Prekrývanie verzií je dovolené (sprinty sa prekrývajú), aktuálna je tá s najneskorším `startsAt`.
- História a changelog zmien buniek (vrátenie importu, história v modáli) sú samostatná, odložená funkcia; verzie ich nenahrádzajú.
