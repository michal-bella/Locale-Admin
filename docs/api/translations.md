---
title: 'API: preklady'
updated: 2026-10-19
notion_page_id:
---

# Preklady (`/api/projects/:projectId/translations`)

Zoznam kľúčov projektu s textom zdrojového a jedného cieľového jazyka pre stránku Preklady, úprava jedného prekladu v riadku a úprava kľúča (názov, popis, plurál). Schémy sú v `packages/shared/src/translations.ts`, dátový model v [Databáza](../database.md#translationkey).

| Metóda  | Cesta                                                           | Prístup            | Popis                                             |
| ------- | --------------------------------------------------------------- | ------------------ | ------------------------------------------------- |
| `GET`   | `/api/projects/:projectId/translations`                         | člen alebo `ADMIN` | stránkovaný zoznam kľúčov, štatistika a namespace |
| `PUT`   | `/api/projects/:projectId/keys/:keyId/translations/:languageId` | člen alebo `ADMIN` | uloženie prekladu kľúča v jednom jazyku           |
| `PATCH` | `/api/projects/:projectId/keys/:keyId`                          | iba `ADMIN`        | premenovanie kľúča, popis, plurálové formy        |

Prístup rieši `requireProjectAccess` rovnako ako ostatné cesty projektu: bez session 401 `AUTH_UNAUTHENTICATED`, mimo prístupu 404 `NOT_FOUND` (viď [projekty](./projects.md#prístup-k-projektu)). `PUT` a `PATCH` prechádzajú CSRF kontrolou (`Content-Type: application/json` a `X-Requested-With: XMLHttpRequest`).

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

| `sort`               | Poradie                                                                             |
| -------------------- | ----------------------------------------------------------------------------------- |
| `UNTRANSLATED_FIRST` | nepreložené najprv, potom `group`, potom kľúč                                       |
| `KEY`                | namespace, `group`, kľúč (kľúče jedného objektu sú spolu, vety namespace pred nimi) |
| `UPDATED`            | čas poslednej zmeny cieľového prekladu, najnovšie prvé, bez riadku na konci; kľúč   |

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
| `description`      | string alebo `null`        | popis kľúča pre prekladateľov (viď úprava kľúča)               |
| `plural`           | objekt alebo `null`        | `{ variable }` pri plurálovom kľúči, inak `null`               |
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
			"description": null,
			"plural": null,
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

## PUT /api/projects/:projectId/keys/:keyId/translations/:languageId

Uloží preklad kľúča `keyId` v jazyku `languageId` (základný aj ostatné jazyky). Riadok `Translation` sa vytvorí alebo prepíše (upsert), `updatedById` je prihlásený používateľ, `updatedAt` čas uloženia.

Telo (schéma `updateTranslationRequestSchema`):

| Pole    | Typ                 | Popis                                                                                                                |
| ------- | ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `value` | string alebo `null` | max. 10 000 znakov (`TRANSLATION_VALUE_MAX_LENGTH`); `null`, `""` aj samé medzery sa uložia ako `null` (Nepreložené) |

Text sa ukladá tak, ako prišiel (bez orezania), HTML aj premenné `{{…}}` ostávajú ako text.

### Ochrana premenných

Keď má projekt zapnuté `protectVariables` (nastavenia projektu, predvolene zapnuté), hodnota v inom ako základnom jazyku musí obsahovať presne tie premenné `{{…}}`, ktoré má hodnota kľúča v základnom jazyku. Premenná sa normalizuje rovnako ako pri [importe](./imports.md#upozornenia-import-prejde): bez medzier, bez úvodného `-` a bez časti od `,`, takže `{{ count }}`, `{{- count}}` aj `{{count, number}}` sú `{{count}}`. Kontrola sa preskočí, keď:

- sa upravuje základný jazyk (ten je zdrojom pravdy),
- je `value` `null`,
- kľúč nemá v základnom jazyku hodnotu (riadok chýba alebo je `null`),
- projekt má `protectVariables` vypnuté.

Pri nezhode sa nič nezapíše a vráti sa 400 `PLACEHOLDER_MISMATCH` s `details: { missing, extra }` – normalizované premenné, ktoré v hodnote chýbajú oproti základnému jazyku, a ktoré sú navyše.

Úprava neberie advisory lock importu: jeden riadok sa zapíše atomicky a súbežný import ostane konzistentný, iba jeho počty (`changes`) môžu byť o tento riadok posunuté.

### Odpoveď 200

Schéma `updateTranslationResponseSchema`, rovnaký tvar ako `target` v zozname:

```json
{ "value": "You have {{count}} items", "status": "TRANSLATED", "updatedAt": "2026-10-19T09:30:00.000Z" }
```

### Chyby

| HTTP | `code`                      | Kedy                                                                                |
| ---- | --------------------------- | ----------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`          | chýba `value`, nie je string ani `null`, alebo má viac ako 10 000 znakov            |
| 400  | `PLACEHOLDER_MISMATCH`      | premenné sa líšia od základného jazyka (viď vyššie), `details: { missing, extra }`  |
| 401  | `AUTH_UNAUTHENTICATED`      | bez session                                                                         |
| 403  | `CSRF_REJECTED`             | bez `X-Requested-With` alebo JSON tela                                              |
| 404  | `NOT_FOUND`                 | projekt mimo prístupu, alebo `languageId` nie je UUID / nie je jazyk tohto projektu |
| 404  | `TRANSLATION_KEY_NOT_FOUND` | `keyId` nie je UUID alebo nie je kľúč tohto projektu                                |

### Príklad (curl)

```bash
curl -i -b cookies.txt -X PUT \
  -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" \
  -d '{"value":"You have {{count}} items"}' \
  "http://localhost:8080/api/projects/<id projektu>/keys/<id kľúča>/translations/<id en>"
```

## PATCH /api/projects/:projectId/keys/:keyId

Upraví kľúč: názov, popis alebo plurálové formy. Iba globálny `ADMIN` (člen s rolou `EDITOR` dostane 403 `FORBIDDEN`; kto nemá k projektu prístup, dostane 404 `NOT_FOUND` ako pri ostatných cestách projektu). Namespace sa meniť nedá.

Telo (schéma `updateTranslationKeyRequestSchema`): každé pole je voliteľné, aspoň jedno musí byť uvedené.

| Pole          | Typ                 | Popis                                                                                                                                                                  |
| ------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`        | string              | nový názov kľúča, orezaný, neprázdny, max. 2 000 bajtov v UTF-8 (`IMPORT_KEY_MAX_BYTES`, rovnaký limit ako pri importe); skupina sa prepočíta                          |
| `description` | string alebo `null` | voľný text pre prekladateľov, orezaný, max. 500 znakov (`TRANSLATION_KEY_DESCRIPTION_MAX_LENGTH`); `null` popis zmaže                                                  |
| `plural`      | objekt alebo `null` | `{ variable }` zapne plurálové formy alebo premenuje premennú (`variable` voliteľné, predvolene `count`, `^[A-Za-z_][A-Za-z0-9_]*$`, max. 50 znakov); `null` ich vypne |

### Plurálové formy

Plurálový kľúč má v `TranslationKey.pluralVariable` názov číselnej premennej a v každom jazyku ukladá **jednu ICU správu** (`serializePluralValue` v `packages/shared/src/plurals.ts`):

```text
{count, plural, one {# položka} few {# položky} other {# položiek}}
```

Kategórie sú CLDR (`zero`, `one`, `two`, `few`, `many`, `other`), jazyk používa svoju podmnožinu (`pluralFormsForTag`: sk `one, few, many, other`, en `one, other`). Text formy môže obsahovať `{{premenné}}`, HTML aj `#` (číslo). Stav prekladu, vyhľadávanie a ochrana premenných pracujú s celou správou ako s textom (premenné `{{…}}` sa nájdu aj vo vnútri formy).

Zmena `plural` prepíše hodnoty kľúča vo všetkých jazykoch v jednej transakcii s úpravou kľúča; `null` hodnoty ostávajú `null`:

| Zmena                          | Čo sa stane s hodnotou                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| zapnutie (`null` → objekt)     | doterajší text sa stane formou `other`: `Máte {{count}} položiek` → `{count, plural, other {Máte {{count}} položiek}}` |
| vypnutie (objekt → `null`)     | ostane text formy `other`; hodnota, ktorá nie je plurálová správa, ostane bez zmeny                                    |
| premenovanie premennej         | správa sa uloží znovu s novou premennou; hodnota, ktorá nie je plurálová správa, ostane bez zmeny                      |
| rovnaké nastavenie ako doteraz | hodnoty sa nemenia                                                                                                     |

### Odpoveď 200

Schéma `updateTranslationKeyResponseSchema`: kľúč ako v zozname, bez prekladov.

```json
{
	"keyId": "6f1c…",
	"namespace": "loc",
	"name": "orders.items",
	"group": "loc:orders",
	"description": "Počet položiek v košíku",
	"plural": { "variable": "count" }
}
```

### Chyby

| HTTP | `code`                      | Kedy                                                                                                                         |
| ---- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 400  | `VALIDATION_ERROR`          | prázdne telo, prázdny alebo pridlhý `name`, `description` nad 500 znakov, `plural.variable` mimo vzoru, `details` podľa poľa |
| 401  | `AUTH_UNAUTHENTICATED`      | bez session                                                                                                                  |
| 403  | `FORBIDDEN`                 | člen projektu bez globálnej role `ADMIN`                                                                                     |
| 403  | `CSRF_REJECTED`             | bez `X-Requested-With` alebo JSON tela                                                                                       |
| 404  | `NOT_FOUND`                 | projekt mimo prístupu                                                                                                        |
| 404  | `TRANSLATION_KEY_NOT_FOUND` | `keyId` nie je UUID alebo nie je kľúč tohto projektu                                                                         |
| 409  | `TRANSLATION_KEY_TAKEN`     | kľúč s novým `name` už v tom istom namespace existuje (unikátny index, bez predbežnej kontroly, nič sa nezapíše)             |

### Príklad (curl)

```bash
curl -i -b cookies.txt -X PATCH \
  -H "Content-Type: application/json" -H "X-Requested-With: XMLHttpRequest" \
  -d '{"name":"orders.items","description":"Počet položiek v košíku","plural":{"variable":"count"}}' \
  "http://localhost:8080/api/projects/<id projektu>/keys/<id kľúča>"
```

## Výkon

Integračný test vytvorí 2 500 kľúčov v 10 jazykoch (95 % riadkov, 10 % z nich `null`). Celá požiadavka vrátane prihlásenia trvá lokálne okolo 10 ms (predvolené zoradenie, vyhľadávanie, `UPDATED` na 10. stránke, filter stavu a namespace). Index `pg_trgm` pre vyhľadávanie preto zatiaľ netreba.

## Príklad zoznamu (curl)

```bash
curl -i -b cookies.txt "http://localhost:8080/api/projects/<id projektu>/translations?sourceLanguageId=<id sk>&targetLanguageId=<id en>&status=UNTRANSLATED&search=objedn"
```
