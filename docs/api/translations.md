---
title: 'API: preklady'
updated: 2026-10-18
notion_page_id:
---

# Preklady (`/api/projects/:projectId/translations`)

Zoznam kľúčov projektu s textom zdrojového a jedného cieľového jazyka pre stránku Preklady. Schémy sú v `packages/shared/src/translations.ts`, dátový model v [Databáza](../database.md#translationkey).

| Metóda | Cesta                                   | Prístup            | Popis                                             |
| ------ | --------------------------------------- | ------------------ | ------------------------------------------------- |
| `GET`  | `/api/projects/:projectId/translations` | člen alebo `ADMIN` | stránkovaný zoznam kľúčov, štatistika a namespace |

Prístup rieši `requireProjectAccess` rovnako ako ostatné cesty projektu: bez session 401 `AUTH_UNAUTHENTICATED`, mimo prístupu 404 `NOT_FOUND` (viď [projekty](./projects.md#prístup-k-projektu)).

## Stav prekladu

Stav sa neukladá, počíta sa z hodnoty v cieľovom jazyku:

- `TRANSLATED` (Preložené): riadok `Translation` existuje a `value` nie je `null`.
- `UNTRANSLATED` (Nepreložené): riadok chýba (napr. jazyk pridaný po importe) alebo `value` je `null`.

## Skupina

`group` počíta backend v SQL, výsledok je rovnaký ako funkcia `translationGroup()` v `packages/shared`:

- Kľúč, ktorý vyzerá ako cesta objektu (`TRANSLATION_KEY_PATH_PATTERN`, `^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$`, bez medzier), patrí do skupiny `namespace:prefix`, kde prefix je časť pred poslednou bodkou. `orders.empty.title` v `loc` → `loc:orders.empty`. Pri prázdnom namespace je skupina iba prefix (`orders.empty`).
- Ostatné kľúče (vety ako `Adresa nie je kompletná. Uistite sa`) sa podľa bodky nedelia, skupina je namespace.

## GET /api/projects/:projectId/translations

Parametre v query (schéma `translationsQuerySchema`). Prázdny reťazec znamená „bez filtra“.

| Parameter          | Typ    | Povinný | Popis                                                                                                 |
| ------------------ | ------ | ------- | ----------------------------------------------------------------------------------------------------- |
| `sourceLanguageId` | UUID   | áno     | jazyk projektu, ktorého text sa zobrazí ako zdroj                                                     |
| `targetLanguageId` | UUID   | áno     | jazyk projektu, pre ktorý sa počíta stav a `stats`; môže byť rovnaký ako zdroj                        |
| `search`           | string | nie     | max. 200 znakov, orezaný; podreťazec bez ohľadu na veľkosť písmen v kľúči, zdrojovom a cieľovom texte |
| `status`           | enum   | nie     | `TRANSLATED` alebo `UNTRANSLATED`                                                                     |
| `namespace`        | string | nie     | presná zhoda namespace                                                                                |
| `sort`             | enum   | nie     | `UNTRANSLATED_FIRST` (predvolené), `KEY`, `UPDATED`                                                   |
| `page`             | číslo  | nie     | od 1, predvolene 1                                                                                    |
| `pageSize`         | číslo  | nie     | 1 až 100, predvolene 50                                                                               |

Znaky `%`, `_` a `\` vo vyhľadávaní sa berú doslovne. Hodnoty idú do SQL iba ako parametre.

Zoradenie (posledné kritérium je vždy ID kľúča, takže stránky sa neprekrývajú):

| `sort`               | Poradie                                                                           |
| -------------------- | --------------------------------------------------------------------------------- |
| `UNTRANSLATED_FIRST` | nepreložené najprv, potom `group`, potom kľúč                                     |
| `KEY`                | namespace, kľúč                                                                   |
| `UPDATED`            | čas poslednej zmeny cieľového prekladu, najnovšie prvé, bez riadku na konci; kľúč |

### Odpoveď 200

Schéma `translationsResponseSchema`.

| Pole         | Typ      | Popis                                                                                                  |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------ |
| `items`      | pole     | kľúče aktuálnej stránky (viď nižšie)                                                                   |
| `total`      | číslo    | počet kľúčov, ktoré spĺňajú filtre (stránka za koncom vráti `items: []` a správny `total`)             |
| `page`       | číslo    | aktuálna stránka                                                                                       |
| `pageSize`   | číslo    | veľkosť stránky                                                                                        |
| `stats`      | objekt   | `{ totalKeys, translated, untranslated }` pre cieľový jazyk cez všetky kľúče projektu, **bez filtrov** |
| `namespaces` | string[] | všetky namespace projektu, zoradené (aj prázdny `""`, ak ho nejaký kľúč má)                            |

Položka `items[]`:

| Pole               | Typ                        | Popis                                                          |
| ------------------ | -------------------------- | -------------------------------------------------------------- |
| `keyId`            | UUID                       | ID kľúča                                                       |
| `namespace`        | string                     | namespace (JSON súbor), `""` ak nemá                           |
| `name`             | string                     | kľúč                                                           |
| `group`            | string                     | skupina (viď vyššie)                                           |
| `source.value`     | string alebo `null`        | text zdrojového jazyka, `null` ak chýba                        |
| `target.value`     | string alebo `null`        | text cieľového jazyka, `null` ak chýba                         |
| `target.status`    | enum                       | `TRANSLATED` alebo `UNTRANSLATED`                              |
| `target.updatedAt` | string (ISO 8601) / `null` | posledná zmena cieľového prekladu, `null` ak riadok neexistuje |

```json
{
	"items": [
		{
			"keyId": "6f1c…",
			"namespace": "loc",
			"name": "orders.empty.title",
			"group": "loc:orders.empty",
			"source": { "value": "Zatiaľ nemáte žiadne objednávky" },
			"target": { "value": null, "status": "UNTRANSLATED", "updatedAt": "2026-10-18T12:00:00.000Z" }
		}
	],
	"total": 1,
	"page": 1,
	"pageSize": 50,
	"stats": { "totalKeys": 30, "translated": 18, "untranslated": 12 },
	"namespaces": ["loc", "paths"]
}
```

### Chyby

| HTTP | `code`                 | Kedy                                                                                                                                                |
| ---- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`     | chýbajúce alebo nevalidné parametre (ID nie je UUID, neznámy `status` / `sort`, `pageSize` nad 100, opakovaný parameter), `details` podľa parametra |
| 401  | `AUTH_UNAUTHENTICATED` | bez session                                                                                                                                         |
| 404  | `NOT_FOUND`            | projekt mimo prístupu, alebo `sourceLanguageId` / `targetLanguageId` nie je jazyk tohto projektu                                                    |

## Výkon

Integračný test vytvorí 2 500 kľúčov v 10 jazykoch (95 % riadkov, 10 % z nich `null`). Celá požiadavka vrátane prihlásenia trvá lokálne okolo 10 ms (predvolené zoradenie, vyhľadávanie, `UPDATED` na 10. stránke, filter stavu a namespace). Index `pg_trgm` pre vyhľadávanie preto zatiaľ netreba.

## Príklad (curl)

```bash
curl -i -b cookies.txt "http://localhost:8080/api/projects/<id projektu>/translations?sourceLanguageId=<id sk>&targetLanguageId=<id en>&status=UNTRANSLATED&search=objedn"
```
