---
status: draft
date: 2026-08-13
---

# `vsor init` — the scaffold

**Business claim:** ownership-by-scaffold. The user's project is theirs from minute 0 — every file
answerable, nothing frozen, nothing rented.

## Observable contract

`uvx vsor init <name>` creates `<name>/` containing **exactly**:

| Path | Content |
| :--- | :--- |
| `instance.md` | valid per `specs/vsor/instance-format`; `vsor.requires` pinned to the running version |
| `knowledge/example.md` | ONE real document demonstrating the frontmatter conventions |
| `site/docusaurus.config.ts` | live seams: title, navbar, footer — a working Docusaurus config |
| `site/custom.css` | design tokens, **including `--ifm-color-primary`** |
| `site/index.tsx` | the homepage |
| `.agents/skills/add-sources/SKILL.md` | content governed by `specs/vsor/add-sources` |
| `AGENTS.md` | how an agent works in the project: the verbs, the customization ladder, the eject pointer |
| `.env` | placeholder `DATABASE_URL=` and embedding key, each with a one-line comment |
| `.gitignore` | covers `.vsor/`, `build/`, `.env` |
| `.git/` | `git init` run — skipped, never clobbered, if already inside a repo |

**Negative contract (equally binding):** no `governance/`, `evals/`, `reflexes/`, `packages/`,
`gateways/`, `node_modules/`, `pyproject.toml`, `package.json` — and **no empty directories
anywhere**.

**Refuse to clobber:** a named target that exists is a hard error. `vsor init .` into a non-empty
directory errors, naming the first five blocking entries; an allowlist of harmless entries
(`.git`, `.nvmrc`, editor files) passes.

**Version pinning:** everything the scaffold pins derives from **one contract value** resolved at
package build time; an unstamped build outside a dev tree fails loudly rather than pinning a
consumer to a placeholder.

**No prompts.** Init asks nothing. (`--with-source` is specified in `specs/vsor/eject`.)

## Acceptance

```bash
uvx vsor init demo
find demo -type f | sort          # exactly the table above; no empty dirs (negative assertions)
git -C demo log --oneline | wc -l # 1 — init committed the scaffold
uvx vsor init demo                # exit != 0, "exists" named
cd demo && uvx vsor init .        # exit != 0, blockers named
```

When `build` lands: the unedited scaffold passes `vsor build` with zero edits (site half), and this
test is added here in the same change.

## Out of scope

Skill content (`specs/vsor/add-sources`) · `--with-source` and ejection (`specs/vsor/eject`) ·
template/theme selection (post-v0) · any interactive question (never — settled decision 1).
