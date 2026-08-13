# AGENTS.md — working in __VSOR_NAME__

This project is a vertical system of record: the markdown under `knowledge/` is the source of
truth, compiled into a website for people and an MCP server for AI assistants — with cited
answers and honest abstention. Scaffolded by vsor __VSOR_VERSION__.

## Commands

| Verb | Status |
| :--- | :--- |
| `vsor init` | implemented — scaffolds a project (it built this one) |
| `vsor dev` | arrives in a later release — running the verb prints its status |
| `vsor build` | arrives in a later release — running the verb prints its status |
| `vsor serve` | arrives in a later release — running the verb prints its status |

Before `vsor build` or `vsor serve` can run, `.env` must hold real values for `DATABASE_URL`
and `GEMINI_API_KEY`.

## Exit codes

This table diverges from the common convention that reserves exit 2 for usage errors — here 2
means an unimplemented verb, stated explicitly so nothing branches on the wrong assumption:

| Code | Meaning |
| :--- | :--- |
| 0 | success |
| 1 | refused — the first stderr line is a stable slug (`error: exists`, `blocked`, `bad-name`, `nested`) |
| 2 | unimplemented verb — it says so honestly and points at its spec |
| 3 | environment or packaging (`error: unsupported-platform`, `error: unstamped`) |

## Rules

- Before adding sources, read `.agents/skills/add-sources/SKILL.md`.
- Secrets go in `.env`, never in command arguments.

## Docs

Docs will ship inside the installed `vsor` package (`docs/`) in a later release. Until then, the
web reference is: github.com/panaversity/zia-vertical-system-of-record-framework
