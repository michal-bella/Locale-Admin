---
name: figma-to-code
description: How to read the Locale Admin Figma design with the Figma MCP, map it to the Mantine theme and export icons through SVGR. Use when implementing or comparing any screen against Figma.
---

# Figma to code

File: `https://www.figma.com/design/8mjlOXj1MXEqGwkWlf83mZ/Admin-system-for-translations` (file key `8mjlOXj1MXEqGwkWlf83mZ`). Node ids in URLs use `-` (`5-2861`), MCP tools take `:` (`5:2861`).

| Screen                                                                                                          | Node                                    |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Login                                                                                                           | `5:2861`                                |
| Users list                                                                                                      | `28:2`                                  |
| New user modal                                                                                                  | `28:191`                                |
| Other screens (Translations, Overview, Languages, Activity, Members, Project Settings, Profile, Import, Export) | `get_metadata` on page `0:1` lists them |

If the Figma MCP is unavailable, stop and ask the user for screenshots.

## Reading a node

1. `get_screenshot` (fileKey, nodeId) for the visual.
2. `get_design_context` for styles and assets. Treat its code as a reference, not as code to paste.
3. The file has **no Figma variables** (`get_variable_defs` is empty; layers like `Container`, `Label:margin` come from an HTML import). Take values from `get_design_context` styles and map them onto the theme instead of creating new values:
    - grays → `slate` (Tailwind v4 palette, e.g. `#62748E` = `slate.5`, `#E2E8F0` = `slate.2`, `#0F172B` = `slate.9`, headings `#020618` = `theme.black`)
    - pink → `brand` (`#E83E8C` = `brand.6`, `#D72F7C` = `brand.7`)
    - radius: inputs and tiles `lg` (12), buttons `md` (10); shadows `primary`, `primary-lg`
    - font sizes: `3xs` 10, `2xs` 11, `xs` 12, `sm` 14, `md` 16; h1 32/48 bold
    - full mapping table: `docs/frontend.md`
4. A value not in the theme yet: add it to `mantineTheme.ts` once and document it in `docs/frontend.md`.

## Icons

1. Download the SVG from the `get_design_context` assets (or `download_assets`) into `frontend/src/assets/icons/<kebab-name>.svg`.
2. `pnpm --filter frontend generate-icons` → React components in `src/components/Icons/` (SVGR, `currentColor`, viewBox kept, `width`/`height` props).
3. Add the export to `src/components/Icons/index.ts` if the script does not.
4. If export fails, use `lucide-react` temporarily and tell the user.

## Visual comparison

Build and run the stack (`pnpm stack:up`), screenshot the page with Playwright, screenshot the node with `get_screenshot`, and list the differences in the report. The user confirms. No automatic `toHaveScreenshot` baselines (shared DB data changes).
