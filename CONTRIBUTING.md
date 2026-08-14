# Contributing

Short, because the long version already exists: **[AGENTS.md](AGENTS.md)** is the durable guide —
vocabulary, settled decisions, invariants, how we work and how we build — and
**[docs/status.md](docs/status.md)** is what is true this week. Read both before the first change.
This file is the mechanics.

## Before you start

Say which **business claim** the change serves: the five-minute promise · honest abstention ·
ownership-by-scaffold · the 80/20 · cost-stays-flat. Work that cannot name one does not get built.

Open an issue first for anything that alters a public surface — a CLI verb, what `vsor init`
writes, an MCP tool, a response envelope, `build.lock.json`, the database schema. Those need a spec
at `specs/<package>/<feature>/spec.md` before code, and a spec is one page: the claim, the
observable contract, the acceptance test, what is out of scope.

## Setup

Requirements: Python 3.14+, [uv](https://docs.astral.sh/uv/), Node 20+ and npm. macOS or Linux; on
Windows use WSL.

```bash
uv sync
(cd packages/sor-site && npm ci && npx playwright install chromium)   # once, for the node lane
```

## The command vocabulary

One Makefile, quoted by AGENTS.md, called by CI, typed by humans and agents, so the three cannot
drift. Users never see it.

| Command | What it runs |
| :--- | :--- |
| `make gate` | lint · typecheck · unit · boundary · the init acceptance. Node-free, seconds. Run it constantly |
| `make wheel` | packs the site runtime into the wheel. Must precede any `uv build` |
| `make build-acceptance` | drives the real wheel through `vsor build` and `vsor dev` |
| `make surface` | the above, plus the browser tier over the built fixture site |
| `make deploy-acceptance` | the hosting tier: the two shapes a static host has, real wheel, real browser |
| `make fmt` | formats and applies safe fixes |

The three node-lane targets stage the same shared paths, so they cannot run concurrently on one
checkout. A change to the CLI needs `gate`; a change to the site or the scaffold needs `surface`;
a change to deploying, host configs, `url` or `baseUrl` needs `deploy-acceptance` as well.

## What a change looks like here

1. **Proof rides with it.** Nothing lands without its tests. The red state comes first, and what it
   printed goes in the commit message or the comment beside the fix.
2. **Walk it live, like a user.** Before a feature is done, its real path is run by hand or by an
   agent driving the actual CLI — browser included for anything with a page. What the live run
   taught is recorded next to the code as a `found live <date>` comment. Most of the defects in
   this repository's history were found that way and by nothing else.
3. **Fix the document the change made false, in the same commit.** Where a ratified spec and the
   code disagree, the code wins and the spec is corrected — visibly, never silently.
4. **One fact, one file.** Everywhere else is a pointer. Counts and constants live where they are
   enforced, not in prose.
5. **Never write the present tense about behaviour that does not run.** If it is not built, say
   "will".
6. **Small increments** — the smallest change that proves the next assumption.

`.agents/skills/implement-spec/SKILL.md` is the implementation form of all of this. Load it before
writing the first line of any spec's implementation.

## Commits and pull requests

Write the subject as a sentence about what changed for a reader of the product, not about which
files moved. Explain in the body what was measured and what it printed. Keep the pull request
reviewable: one document or one tight group per change — a forty-file rewrite will not be reviewed,
so it is not governed.

Do not commit generated output: `build/`, `.vsor/`, `dist/`, `node_modules/`. `build.lock.json` is
the exception and is committed on purpose.

## Reporting a security issue

Not here. See **[SECURITY.md](SECURITY.md)**.

## Licence

By contributing you agree your contribution is licensed under Apache-2.0, the licence of this
repository. If you bring in third-party code, it goes in `NOTICE` in the same change.
