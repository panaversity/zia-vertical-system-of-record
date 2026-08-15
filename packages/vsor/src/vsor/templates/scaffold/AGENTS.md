# AGENTS.md — working in __VSOR_NAME__

This project is a vertical system of record: the markdown under `knowledge/` is the source of
truth, compiled into a website for people and an MCP server for AI assistants — with cited
answers and honest abstention. Scaffolded by vsor __VSOR_VERSION__.

## Commands

| Verb | Status |
| :--- | :--- |
| `vsor init` | implemented — scaffolds a project (it built this one) |
| `vsor dev` | implemented — live site at 127.0.0.1:3000 (`--port` changes it), hot-reloading from `knowledge/` |
| `vsor build` | implemented — emits `build/` (the deployable static site) and `build.lock.json` (the committed record) |
| `vsor serve` | arrives in a later release — running the verb prints its status |

`vsor dev` and `vsor build` read nothing from `.env` — leave it as scaffolded until it is needed.
Its two values (`DATABASE_URL`, `GEMINI_API_KEY`) are for the MCP-server verbs — `vsor serve` and
the ingest behind it — which arrive in a later release. The first `dev` or `build` installs the
site runtime under `.vsor/` (one time, ~1–2 minutes, network required); let it finish.

## Exit codes

This table diverges from the common convention that reserves exit 2 for usage errors — here 2
means an unimplemented verb, stated explicitly so nothing branches on the wrong assumption:

| Code | Meaning |
| :--- | :--- |
| 0 | success — including `vsor dev` stopped with Ctrl-C |
| 1 | refused, or the input speaking — the first stderr line is a stable slug (`error: exists`, `blocked`, `bad-name`, `nested`, `instance-invalid`, `build-failed`, `bad-port`, `port-in-use`, `dev-failed`, `project-busy`, `symlink-unsupported`, `knowledge-invalid`) |
| 2 | unimplemented verb — it says so honestly and names what this release does implement |
| 3 | environment or packaging (`error: unsupported-platform`, `error: unstamped`, `error: missing-runtime`, `error: install-failed`, `error: build-crashed`, `error: io-failed`) |

## The rules

Four short files in `.claude/rules/` govern all work here. Read them once; they are the difference
between a corpus and a pile of documents.

| Rule | Says |
| :--- | :--- |
| `provenance.md` | every claim traces to a source document, with its values copied exactly |
| `abstention.md` | "not in this corpus" is a correct answer — never fill a gap from general knowledge |
| `review.md` | the agent writes, the human checks; the site is preview, not an approval |
| `repository-map.md` | what lives where: content in `knowledge/`, presentation in `site/`, nothing authored in generated directories |

## The skills

Each skill is a directory under `.agents/skills/` holding a `SKILL.md`. Load one by reading its
file before starting that kind of work — the whole point is that the method does not have to be
re-derived each session.

| Skill | Use when |
| :--- | :--- |
| `add-sources` | anything is about to enter `knowledge/` — the entry point, and it points at the rest |
| `docx` | the source is a Word document |
| `pptx` | the source is a slide deck |
| `fetch-library-docs` | a claim is about someone else's system — a library, API, standard or product |
| `knowledge-extraction-method` | starting a corpus, or working an expert and a document set into one |
| `technical-clarity` | a document is written and needs to be readable without losing precision |
| `content-refiner` | a document is padded, duplicated or buries its answer |
| `canonical-format-checker` | checking documents against this project's actual format, especially after a bulk conversion |
| `summary-generator` | a document needs the short "in short" opening a search-arriving reader reads first |
| `quiz-generator` | a document needs a `<Quiz />` self-check |
| `generate-flashcards` | a document holds definitions or thresholds a reader must carry in their head |
| `deploy` | the site is about to be published, or where it is served from is changing |
| `skill-creator` | a job here has repeated and should stop being re-derived |
| `find-skills` | the capability sounds general enough that someone has already published it |

## Working here

- Before adding sources, read `.agents/skills/add-sources/SKILL.md`.
- Secrets go in `.env`, never in command arguments.
- Read the rendered page before calling a document done: `vsor dev`, then open it.
- Never hand-edit `build/`, `.vsor/` or `build.lock.json` — they are generated.
- **One vsor at a time here.** `vsor build` while `vsor dev` is serving is refused
  (`error: project-busy`): both rewrite the site runtime under `.vsor/`, so the second would
  corrupt the site the first is serving. Stop the dev server, or wait for it.
- **Documents are real files** — never symbolic links, and never a pipe or a socket. Anything else
  inside `knowledge/` or `site/` is refused (`error: symlink-unsupported`): `build.lock.json`
  hashes the regular files it publishes, so anything it cannot hash would be served by the site and
  absent from the record. Copy the file in instead.
- **Every document in `knowledge/` is published.** `draft: true` is refused
  (`error: knowledge-invalid`) — it would leave a row in `build.lock.json` with no page behind it.
  Keep a document that is not ready outside `knowledge/` until it is.
- **A replaced document is marked, never deleted.** `superseded_by:` in its frontmatter names
  what replaced it, and the page then opens with a notice saying so. `vsor build` refuses a
  pointer that names a document this project does not publish (`error: knowledge-invalid`), so a
  reader never follows one that leads nowhere. `vsor dev` does not refuse it — writing the
  successor second is an ordinary way to work. Write `true` and `false` in full: `yes` and `on` are
  plain text to the parser that renders the page, so the notice would silently never appear. The
  keys are in `.claude/rules/provenance.md`.

## Publishing

`vsor build` writes `build/` — ordinary static files that any host serves. Two ways to publish,
and the difference is only who runs the build:

- **The host builds it.** Add one config file at the repository root — the deploy skill carries the
  exact contents for Vercel, Netlify and Cloudflare Pages — and a connected repository deploys on
  push. This needs `vsor` installable from PyPI — check with `uvx vsor --version`, and use the
  other path if it reports that vsor was not found in the package registry.
- **You build it, then upload.** `vsor build`, then `netlify deploy --dir=build --prod`, a bucket,
  GitHub Pages, or your own nginx. Works today — and the corpus never leaves your machine, which
  is the right choice for a corpus that may not travel.

Before the first deploy, set `url` (and `baseUrl` for a subpath host) in
`site/docusaurus.config.ts` — Docusaurus writes them into the sitemap, the canonical links and the
Open Graph tags, so a default build advertises `localhost` to search engines.

`build/` is git-ignored while `build.lock.json` is committed: the record of a build travels with
the repository, and the output is reproducible from it. The deployable directory carries a copy of
that same record at `build/build.lock.json`, so "is the site that is live the one this repository's
record describes" is answerable by comparing one `build_id` — including against a host that built
it for you.

Read `.agents/skills/deploy/SKILL.md` before deploying — including how to verify a deploy rather
than trusting the URL a CLI printed.

## Docs

**Everything needed to work in this project is in this project** — this file, the four
`.claude/rules/`, and the fourteen `.agents/skills/`. That is deliberate: none of it needs a
network, and none of it can rot away from the version that scaffolded it. Publishing in
particular is complete here, in `.agents/skills/deploy/SKILL.md`, including the command for each
host.

Reference docs will ship inside the installed `vsor` package (`docs/`) in a later release. The
framework's source repository is github.com/panaversity/zia-vertical-system-of-record —
it is where the specs and the CHANGELOG live, and it is not needed to use what is here.
