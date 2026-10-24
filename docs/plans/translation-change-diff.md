---
title: 'Zmena prekladu v Histórii – plán'
updated: 2026-10-24
notion_page_id:
---

# Zmena prekladu v Histórii

## Kontext

Stránka **História** (`/projects/$projectSlug/history`) ukazuje pri úprave prekladu iba vetu „úprava prekladu orders.title (angličtina)“. Používateľ chce pri takom riadku **informatívne vidieť, čo sa zmenilo**: kto, kedy, ako a starý text oproti novému, zvýraznené po slovách ako diff v pull requeste na GitHube. Obnovenie starej hodnoty ani iná akcia nebude.

Dáta už existujú. Každá ručná úprava bunky zapíše v tej istej transakcii udalosť `TRANSLATION_UPDATED` s `payload.oldValue` a `payload.newValue` ([translations.service.ts](../../backend/src/services/translations.service.ts), `updateTranslation`) a `GET /api/projects/:projectId/activity` vracia celý `payload`. Zmena je preto **iba na frontende**: bez úpravy backendu, kontraktu v `packages/shared` aj migrácií.

Vetva `feat/translation-change-diff` (z `main` = `aca350c`).

### Požiadavky používateľa

- Iba udalosti **úpravy prekladu**. Úprava kľúča, import a ostatné typy detail nemajú.
- V modáli: kto, kedy, aký kľúč a jazyk, starý a nový text.
- Zvýraznenie **po slovách**: odstránené slová červenou a prečiarknuté, pridané zelenou (knižnica `diff` / jsdiff).
- Iba zobrazenie, žiadny restore.

### Predpoklady (potvrdiť)

| Predpoklad                                                                                                                                    | Prečo                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Detail je zatiaľ iba v tabuľke **Histórie**, nie v Poslednej aktivite na Prehľade.                                                             | Používateľ hovorí o Histórii. Modál bude samostatný komponent, takže pridať ho do `ActivityFeed` neskôr je jedna ikona navyše.                   |
| Detail vidí **každá rola** vrátane Návštevníka.                                                                                                | Je to iba čítanie; História je dostupná aj Návštevníkovi.                                                                                         |
| Plurálový kľúč sa diffuje ako **surový text** ICU správy (`{count, plural, one {…} other {…}}`), nie po formách.                               | Najjednoduchšie a zvýraznenie po slovách zmenu vo forme aj tak ukáže. Rozdelenie po formách sa dá doplniť neskôr cez `parsePluralValue`.         |
| Ikona akcie v riadku bude **nová** `Eye` („Zobraziť zmenu“) v štýle ostatných ikon (17 px, ťah 1,275), vložená cez `pnpm generate-icons`.     | Žiadna súčasná ikona (`File`, `Edit`, `ArrowRight`) nehovorí „pozrieť“. Ak je vo Figme vhodná ikona, použije sa tá.                              |
| Riadok ďalej ponecháva šípku → na Preklady (otvorí bunku v modáli Upraviť preklad). Nová ikona je **pred** ňou.                               | Pravidlo projektu: akcie v riadku sú samostatné ikony, žiadne ⋯ menu.                                                                            |

## Návrh

### Riadok v tabuľke Histórie

`ActivityHistoryTable`, stĺpec akcií: pri `event.type === ACTIVITY_TYPE.TRANSLATION_UPDATED` tlačidlo `RowAction` (ikona `Eye`, tooltip **Zobraziť zmenu**, prístupné meno „Zobraziť zmenu prekladu orders.title (angličtina)“), za ním existujúci `ActivityEventLink`. Ostatné riadky sa nemenia. Vybraná udalosť je stav tabuľky (`useState<ActivityEvent | null>`), modál je jeden pre celú tabuľku.

### Modál `TranslationChangeModal`

`AppModal` (šírka 880 px, pôvodne `lg`; širšia kvôli dlhším textom), titulok **Zmena prekladu**, popis = kľúč (`namespace:name`, ako v tabuľke prekladov), pätička iba **Zavrieť**.

- Hlavička: jazyk s vlajkou (`LanguageFlag`) a názvom, verzia (ak existuje), kto (`ActivityAvatar` + meno, „Zmazaný používateľ“ po zmazaní) a kedy (`formatDateTime` + relatívny čas).
- Dva bloky so šípkou → medzi nimi (stav pred a po), na širokom modáli vedľa seba (od `sm`), na telefóne pod sebou so šípkou nadol:
    - **Pred**: spoločný text a **odstránené** úseky (`<del>`, pozadie `--mantine-color-red-light`, prečiarknutie, farba `--mantine-color-red-light-color`).
    - **Po**: spoločný text a **pridané** úseky (`<ins>`, pozadie `--mantine-color-teal-light`, bez podčiarknutia, farba `--mantine-color-teal-light-color`). Rovnaké odtiene ako stavy Nepreložené a Preložené, takže fungujú aj v tmavom režime.
- Text má `white-space: pre-wrap` a `overflow-wrap: anywhere` (zachová riadky a nerozbije modál dlhým kľúčom alebo URL).
- Prázdna stará hodnota (`null`, prvý preklad): blok Pred ukáže tlmený text „Nepreložené“ a celý nový text je pridaný. Prázdna nová hodnota (vymazanie): blok Po ukáže „Hodnota vymazaná“ a celý starý text je odstránený.
- Prístupnosť: bloky majú nadpisy Pred a Po (`<h3>`), takže čítačka prečíta celý starý a nový text. Farby a prečiarknutie sú doplnkové; `<del>` a `<ins>` nesú význam aj bez farby.

### Diff

```ts
import { diffArrays } from 'diff'

const segmenter = new Intl.Segmenter(languageTag, { granularity: 'word' })
const words = (value: string | null) => Array.from(segmenter.segment(value ?? ''), ({ segment }) => segment)
const changes = diffArrays(words(oldValue), words(newValue))
```

- Pôvodne `diffWordsWithSpace(old, new, { intlSegmenter })`. Pri implementácii sa ukázalo, že `diffWordsWithSpace` možnosť `intlSegmenter` **ignoruje** (podporuje ju iba `diffWords`; dokumentácia jsdiff to uvádza nepresne) a jeho tokenizér pozná iba latinku, takže cyriliku porovnal po písmenách. Text preto delí `Intl.Segmenter` v jazyku prekladu a porovnáva `diffArrays`. Medzery a nové riadky ostávajú samostatné tokeny, ako pri `diffWordsWithSpace`.
- `ChangeObject` má `value` (tu pole tokenov), `added`, `removed`. Blok Pred vykreslí časti s `!added`, blok Po časti s `!removed`.
- Knižnica `diff` **9.0.0** (najnovšia, vydaná 2026-04-13, teda staršia ako `minimumReleaseAge` 14 dní v `pnpm-workspace.yaml`), v `frontend/package.json` pripnutá presne. Používa ju iba lazy chunk stránky História: `projectHistoryRoute.lazy` 8,7 kB → 20 kB (gzip 3,0 → 6,9 kB), štart aplikácie sa nemení.

## Kroky

| #   | Krok                                                                                                                                                                                                                       | Overenie                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1   | Závislosť `diff@9.0.0` do `frontend`, ikona `Eye` (`src/assets/icons/eye.svg` → `pnpm --filter frontend generate-icons`).                                                                                                    | `pnpm install`, `pnpm --filter frontend typecheck`                                              |
| 2   | `components/TranslationChangeModal` (`TranslationChangeModal.tsx`, `types.ts`, `.module.css`): hlavička, bloky Pred / Po, diff (`Intl.Segmenter` + `diffArrays`), stavy `null`. Preklady `historyPage.change.*` v `sk`, `cs`, `en`.        | unit test komponentu: zvýraznené slová, prvý preklad, vymazanie, cyrilika po slovách            |
| 3   | `ActivityHistoryTable`: ikona **Zobraziť zmenu** iba pri `TRANSLATION_UPDATED`, stav vybranej udalosti, modál.                                                                                                              | `HistoryPage.test.tsx`: ikona iba pri úprave prekladu, otvorí modál so správnym textom, Zavrieť |
| 4   | Vizuálna kontrola v prehliadači (svetlý aj tmavý režim, šírka telefónu, dlhý text), veľkosť lazy chunku Histórie.                                                                                                           | screenshot, `pnpm --filter frontend build`                                                     |
| 5   | Dokumentácia: sekcia História v `docs/frontend.md` (ikona, modál, diff, závislosť `diff`), `docs/changelog.md`, tento plán. E2E: v existujúcom teste Histórie otvoriť zmenu prekladu (ak tam taká udalosť je).             | `pnpm verify`; E2E proti Docker stacku podľa dohody                                            |

## Mimo rozsahu

- Obnovenie starej hodnoty (restore) a akákoľvek úprava z modálu.
- Detail importu, úpravy kľúča (názov, popis, plurál) a ostatných udalostí.
- História jednej bunky (všetky jej úpravy pod sebou) a filter API podľa kľúča: potrebovali by filter cez `payload->>'keyId'` a výrazový index.
- Retencia udalostí (mazanie starších úprav bunky). Dnes sa ukladá každá úprava a nie je to problém.
