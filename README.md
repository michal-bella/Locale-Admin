# Locale Admin

Admin aplikácia na správu prekladov pre organizácie a ich projekty.

- Dokumentácia: [`docs/`](docs/README.md)
- Plán aktuálnej fázy: [`docs/plans/phase-1.md`](docs/plans/phase-1.md)
- Pravidlá pre AI agentov: [`AGENTS.md`](AGENTS.md)

## Rýchly štart

Požiadavky: macOS alebo Linux, Docker Desktop, Node 24 (`nvm use`), pnpm cez corepack (`corepack enable`).

```bash
cp .env.example .env
pnpm install
pnpm db:up && pnpm db:migrate
pnpm dev
```

FE beží na `http://localhost:5173`, BE na `http://localhost:3000`. Produkčný stack v Dockeri (`http://localhost:8080`): `pnpm stack:up`. Podrobnosti v [`docs/local-development.md`](docs/local-development.md).

## AI tools

Zdrojom pravdy pre všetky AI nástroje je `AGENTS.md` (root aj moduly), `.agents/agents/` (role), `.agents/skills/` (skills), `.agents/workflows/` a `scripts/`. Konfigurácie jednotlivých nástrojov sú iba tenké adaptéry, ktoré na tieto súbory odkazujú. Pravidlá sa do nich nikdy nekopírujú.

| Nástroj     | `AGENTS.md`                           | Skills                                          | Subagenti                                                                                                                     |
| ----------- | ------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Claude Code | `CLAUDE.md` obsahuje iba `@AGENTS.md` | `.claude/skills` je symlink na `.agents/skills` | `.claude/agents/<rola>.md`: frontmatter (`name`, `description`, `tools`) a jedna veta s odkazom na `.agents/agents/<rola>.md` |
| Codex       | číta `AGENTS.md` natívne              | číta `.agents/skills` natívne                   | `.codex/agents/<rola>.toml`: `name`, `description` a `developer_instructions` s odkazom na `.agents/agents/<rola>.md`         |
| Cursor      | číta `AGENTS.md` natívne              | číta `.agents/skills` natívne                   | načíta `.claude/agents/` (vlastný adaptér netreba)                                                                            |

Overené voči dokumentácii k 2026-10-16: [Claude Code](https://code.claude.com/docs), [Codex skills](https://developers.openai.com/codex/skills), [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), [Cursor skills](https://cursor.com/docs/skills), [Cursor subagents](https://cursor.com/docs/subagents).

Pri zmene roly sa mení iba `.agents/agents/<rola>.md`. Ak sa zmení jej účel, treba zosúladiť aj `description` v oboch adaptéroch, je to jediný duplikovaný údaj.

Symlinky fungujú na macOS a Linuxe bez ďalšieho nastavenia. Windows sa nepodporuje.
