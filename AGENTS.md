# AGENTS.md

The durable guide to this repository: what the thing is, the vocabulary, the settled decisions, the
invariants, and how it is built and tested. Loaded every session, so it holds only what stays true.

- **What the product is:** the pitch and diagram live in [`README.md`](README.md) — their only home.
- **What is true this week:** [`docs/status.md`](docs/status.md) — read before starting work.
- **The extraction work list:** [`docs/extraction.md`](docs/extraction.md).

---

## What this is, in one line

A CLI (`vsor` — PyPI package and binary share the name) that compiles a folder of governed markdown
into two surfaces — a static website for people and an MCP server for AI assistants — with cited
answers and honest abstention. It is not an agent framework; it is the knowledge layer agent
frameworks read from (that layer is `eve`'s — we are upstream of it).

**Which verbs exist today is not recorded here.** This file describes what vsor *is*; what is built
this week lives in [`docs/status.md`](docs/status.md), and what shipped in
[`CHANGELOG.md`](CHANGELOG.md). One rule holds it: a verb that is not implemented says so on stderr
and exits 2, so the CLI itself is always the current answer — no document has to be kept in step
with it. *(Corrected 2026-08-14: this paragraph used to name the implemented verbs, which made the
always-loaded file wrong at every release and duplicated the one document whose job that is.)*

Two non-negotiable properties:

- **One source, many surfaces.** Everything derives from the same markdown. Adding a surface never
  requires editing a corpus.
- **Governance is a ladder, not a gate.** Level 0 works immediately; callers climb only as far as
  their domain needs. Demanding level 4 of a level-0 project is a bug, not rigour.

## What we claim, and to whom

The positioning, settled with the owner 2026-08-15. It is here rather than only in `README.md`
because a session that re-derives it tends to describe the machinery instead of the value, and
because two of these claims have a precise boundary that is easy to overstate.

- **A system of record is the one place the official version lives.** When the ledger and a
  spreadsheet disagree, the ledger wins. Businesses have had them for decades; **AI never did** —
  it answers from everything it has ever read, which is exactly why it cannot tell you which of its
  sentences were checked. A *vertical* system of record is that, for one profession.
- **Vendor-free is the ownership argument.** The agent surface speaks MCP, an open standard, so one
  corpus answers in Claude, in ChatGPT, inside an agent framework, or in a worker the owner wrote.
  What a customer owns is the source; runtimes are interchangeable, so changing model or vendor does
  not redo the work. Never position this as an integration with one assistant.
- **The interesting problem is not retrieval.** Chunking, embedding and hybrid search are commodity.
  Whether an agent can be *trusted* in a regulated field is decided by the governance of what it
  reads — provenance, a numbered generation to cite, and a measured floor under which it declines.
  Lead with that, not with the pipeline.
- **Agents are the operator, not the audience for a manual.** The owner is not meant to run this
  themselves; they tell the coding agent they already use. Every scaffolded project therefore ships
  skills and rules — that is why settled decision 5 was revised, and why the kit is a product
  surface rather than documentation.
- **Out of the box the owner touches knowledge only** — plain markdown, in any language they write
  in. (The *documents* are language-agnostic; the interface is not — i18n machinery is deferred
  post-v0. Do not promise a translated UI.)

**The customization boundary, stated exactly, because it has been got wrong in both directions:**
`site/` is real, durable, editable Docusaurus — config, tokens, homepage, sidebar. After a build the
*whole site application* is also present as readable source at `.vsor/site-runtime/src/`, so an
agent can open the real Navbar rather than guess at it — but that tree is regenerated whenever the
materialization stamp changes, so edits there do not survive. Durable ownership of a component is
`vsor eject`, which is **designed and not built** (settled decision 11's correction). Say
"readable today, durable when eject lands" — never "the source ships so you can change anything",
and never "the machinery is hidden".

## Vocabulary

Used precisely; do not repurpose. "Reader" is not a term here — say *surface* (software) or
*stakeholder* (human).

| Term | Means |
| :--- | :--- |
| **corpus** | the governed markdown under `knowledge/` — the source of truth |
| **instance** | one deployment configured: corpus, database, floors, budgets. **Not governance** |
| **build** | one execution of `vsor build`, identified by a `build_id` |
| **generation** | the monotonic version of ingested content in Postgres — what a citation points at |
| **`build.lock.json`** | the committed record of a build: what was ingested, from which commit, with which embedder |
| **surface** | something that serves the content — the website and the MCP server |
| **level** | how much governance a project has climbed to, 0–4 |
| **abstain** | the corpus does not cover this — a correct answer, never an error |
| **eve** | Vercel's open-source agent framework (Apache-2.0, 2026). Runs agents; consumes knowledge layers like this one. A consumer and distribution target, never a competitor |

## Settled decisions

One line each; the reasoning lived in review and needs no re-litigating. Reversing one requires new
evidence, recorded here with a revision note.

1. **Conversation is the interface.** The human types `vsor init <name>`, then talks to the agent
   they already use. CLI verbs are for the *agent* to run. v0 verbs: `init` · `dev` · `build` · `serve`;
   `check`, `sync`, `info --json` come after v0. `dev` is watch mode — the site hot-reloads
   straight from `knowledge/`, the MCP surface serves the latest build with a debounced
   incremental re-ingest (content-hash carry-forward: only changed documents re-embed, so cost ∝
   change). `serve` is production: built artifacts, nothing watching.
   *Revision 2026-08-13: package and binary are both `vsor` — PyPI is free, and all four studied
   frameworks use one name (a rename leaves a deprecation stub forever). The earlier
   `ziavsor`-package hedge is retired.*
2. **One project, scaffolded into the user's own repo**, git initialized (existing repos detected,
   never clobbered). Ownership comes from the scaffold, not from repo separation.
3. **Install:** the CLI is installed via `uvx vsor`; the runtime arrives as locked, pinned
   dependencies — not vendored source. The escape hatch is that your content, config, database
   schema and `build.lock.json` live in *your* repo: walking away loses you nothing.
4. **Licence:** Apache-2.0, one licence, no code/content split. A vertical's corpus is licensed by
   whoever owns the project it lives in.
5. **Skills are the product surface.** v0 ships exactly one: `add-sources`. The other five
   (review-coverage, add-governance, define-policy, deploy, build-worker) are named, deferred.
   *Revision 2026-08-13 (owner, on seeing the first served site): **the scaffold ships a real agent
   kit, not one skill.*** A project holding a single SKILL.md feels unspecialized — the same
   complaint that rejected the bare theme. The scaffold now carries the **structure** upstream
   proved (`.claude/settings.json` with the vsor verbs pre-permitted, `.claude/rules/` for how to
   work a governed corpus, `.agents/skills/` for the doing) and the **corpus-generic** skills from
   `ag2/.claude/skills` — source conversion (`docx`, `pptx`, `fetch-library-docs`), knowledge work
   (`knowledge-extraction-method`, `technical-clarity`, `content-refiner`,
   `canonical-format-checker`), the primitives this framework already ships components for
   (`quiz-generator`, `generate-flashcards`, `summary-generator`), and the meta ones
   (`skill-creator`, `find-skills`). Curriculum-specific skills (chapter/lesson/course/teach, auth
   guides, the ~60 others) stay behind — copying those into a tax-law SoR would re-import the
   product layer through the side door. The five deferred vsor skills are unaffected: they are
   *verbs we have not built*, not documents we can copy.
   *Revision 2026-08-14: `deploy` ships in the kit — the first of those five to land, and it landed
   as a **document, not a verb**. It needed no code: `vsor build` already emits an ordinary static
   directory, so the missing thing was the knowledge of what to do with it (the two `url`/`baseUrl`
   values baked into the output, the two deploy shapes, how to verify a URL rather than trust it) —
   exactly the shape a SKILL.md holds. It arrived alongside `vercel.json` and `netlify.toml` at the
   scaffold root — **withdrawn the same day on the owner's challenge**, and rightly: a framework has
   no business writing a vendor's file into every project, two of any three would always be deleted,
   and none could work before vsor was on PyPI. The host configs live inside the skill as
   copy-paste blocks an agent writes once the owner has picked a host. The remaining four stay
   deferred and stay verbs.*
6. **The governance level is derived, never declared.** `vsor check` (post-v0) reports the level the
   `governance/` directory achieves; there is no `governance:` key on the instance. `instance.md`
   describes the *deployment*; `governance/` describes the *knowledge*.
7. **The site is preview and review, not an editor.** The agent writes; the human checks.
8. **What `build` emits:** a committed `build.lock.json` (build_id, commit sha, corpus tree sha,
   embedder + chunker versions, one row per document), a gitignored `.vsor/` scratch dir, Postgres
   rows under a new generation, and the static `build/`. **No archive, tarball or package** — that
   was an upstream deployment detail, not a build output.
   *Revision 2026-08-15, from the pre-publish record audit: the record is **format 2**, and the
   artifact carries a copy of it.* Format 2 adds two fields, both provenance rather than content,
   and it was taken now because a format bump after a PyPI release is a migration. **`corpus.prefix`**
   — the project root's path inside the repository `corpus.git` names — because `documents[]` rows
   are project-relative and a project below the repo root is the layout `vsor init` instructs the
   user into, where `<sha>:knowledge/x.md` resolves to nothing; a citation resolves
   `<git>:<prefix><path>`. **`site.app`**, the forked site application's own bytes, which also
   enters the `build_id` preimage: the app is unpacked over the shell rather than installed, so no
   npm integrity hash covers it and two builds by one vsor version with different forks collided.
   And **`build/build.lock.json`** — the same record, written into the staging tree before the
   swap — so a deployed directory and a committed record can be compared by anyone; before it, a
   record/artifact divergence was undetectable by any means. The evidence for all three, and the
   negative results beside them, are in `docs/status.md`.
9. **Schema migrations land as one pass** with a runner (lifted from `sor-learning`'s numbered
   migrations), covering jurisdiction/effective dates, `corpus_id` on the **five** content tables
   (`content_nodes`, `sources`, `chunks`, `slug_aliases`, `node_centroids`), approval rows,
   `text_search_config`, the archive table, auditor role, takedown write path.
10. **The user's database is any Postgres DSN in `.env`** — Neon free tier recommended (production
    is already Neon), any commodity Postgres works. **Docker is never a user requirement.** A
    `docker compose` for `pgvector/pgvector:pg17` is framework dev/CI machinery and **arrives with
    the ingest code that needs it** — it was committed in Phase 0, used by nothing for two weeks,
    and removed 2026-08-15 rather than sit at the root of a public repository implying that a
    static-site generator wants a database.
    `.env` is the whole user config surface: `DATABASE_URL` + the embedding key (Gemini at beta 1,
    user-supplied; provider pluggability post-v0).
    *Revision 2026-08-13: previously framed docker as the dev default for everyone — the user asked
    the right question ("why docker if Neon?") and the answer split user path from framework path.*
11. **The user's project is content and config only — machinery invisible** (decided 2026-08-13).
    `init` writes markdown, `instance.md`, skills, `AGENTS.md` — no `pyproject`, no `node_modules`,
    no copied source. **Customization is a verb, not a default:** the design is that
    `vsor eject <component>` *will* materialize framework source on demand (first target: `site`;
    also `docker` for a deploy-anywhere Dockerfile; `all` for the kernel), with the runtime
    preferring the ejected copy and `build.lock.json` recording it, so a build from modified source
    is visibly not a stock build — the shadcn source-access experience, agent-self-served instead of
    pre-copied.
    *Corrected 2026-08-14: this decision was written in the present tense and every clause of it was
    false — there is no `eject` verb, no `lib/` preference in the runtime, and the scaffolded
    AGENTS.md names no such command. The lock's field is `non_stock`, not `ejected`, and it exists
    precisely so the record needs no migration when the verb lands. What a project customizes TODAY
    is `themeConfig`, the design tokens in `site/src/css/custom.css`, `site/src/pages/` and
    `site/sidebars.ts`; the shell owns `src/theme/`, so swizzling is not a seam yet either. The
    rule this violated is our own — never the present tense about behaviour that does not run.*
    *Revision 2026-08-13, from the customization-surface audit (evidence: both codebases +
    the book's own method):* **the line between "present source" and "installed machinery" is
    drawn per layer, and it is the authored-vs-machinery line:*
    - **The authored layer is real source in the project from day one** — markdown, `instance.md`,
      and a thin REAL Docusaurus shell (`site/`: config + css tokens + homepage, ~500 lines). No
      invented mapping layer: agents know `docusaurus.config.ts`, `--ifm` tokens and
      `docusaurus swizzle` from training data; an instance.md→config indirection would be the one
      thing nobody knows. (The owner's instinct, confirmed — with the twist that copying the FULL
      upstream app would be anti-lean: 112k lines, dead decoy seams, product entanglement.)
    - **Machinery stays installed** — retrieval kernel, ingest, gateway, theme-package internals.
      Upstream's own practice: no product or instance forks domain source anywhere; its product.md
      rules against copies verbatim ("a second copy is a second thing to drift"). The kernel has
      zero training-data presence and its guardrails (5.7k test lines, 672MB eval artifacts)
      cannot ship in a scaffold.
    - **The ladder per layer:** site = Docusaurus-native (themeConfig → css tokens →
      `site/src/pages/` → `site/sidebars.ts`); kernel = instance config → declared seams
      (tool-description chain, serve-time hooks) → eject as the recorded escape hatch. Ejection
      lands in `build.lock.json` — customization allowed, provenance intact.
      *Revision 2026-08-14, found live:* this rung used to end in `swizzle --wrap/--eject`, and at
      0.1.0 that is **not a seam the fork implements**. Since the runtime shell became the siteDir,
      Docusaurus resolves `@theme/*` out of `.vsor/site-runtime/src/theme` — the shell's own — and
      the shell merges exactly four things from a project's authored `site/`: `sidebars.ts`,
      `src/pages/`, `src/css/custom.css` and `static/`. A component dropped in `site/src/theme/`
      is read by nothing. Swizzle is post-v0 and needs a real merge in
      `packages/sor-site/app/docusaurus.config.ts` before it may be promised again. (What survives
      of the claim: `themeConfig`, the `--ifm` tokens and a React page under `src/pages/` are all
      still seams an agent's training data already knows.) **Composition is
    config, never copies:** a second corpus or SoR is a second collection/instance, not source in
    the project.
12. **Serving defaults fail safe** (decided 2026-08-13). Local `vsor serve`: auth **off**, bound to
    `127.0.0.1` only. A public bind fails closed unless an OAuth provider is configured — any
    standards-compliant service via the MCP auth spec (RFC 9728 protected-resource metadata),
    Panaversity SSO being one option, never a requirement — or unauthenticated serving is explicitly
    flagged (`--allow-unauthenticated`). "Disabled by default" must never silently become an open
    server on the internet.
13. **Positioning names the competitor first.** CoCounsel Legal already serves governed professional
    knowledge over MCP; our claim is the narrow one — a governed *curriculum* with an *explicit
    abstention guarantee*, instantiable by anyone.

## What `vsor init` writes

The one authoritative scaffold tree — and it is **generated**, not written. Its source is
`packages/vsor/src/vsor/templates/scaffold/`, the bytes `vsor init` copies; `tests/scaffold_tree.py`
renders it and `tests/test_generated_docs.py` fails when document and templates disagree. Authored
there: the order of the entries and the note beside each. Derived: every path, every name, every
count. **Do not hand-edit the block** — change the templates, then run
`uv run --package vsor python tests/scaffold_tree.py --write`. (An earlier, larger tree showing six
skills and a `governance/` directory was a target state, not the scaffold — it caused false
first-run beliefs and is gone.)

<!-- generated from packages/vsor/src/vsor/templates/scaffold/ — see tests/scaffold_tree.py -->
```
my-sor/                          ← created by `vsor init my-sor`; yours, your licence
├── instance.md                  frontmatter = machine config; body = the MCP server's prompt
├── knowledge/example.md         ONE real example document — never an empty directory
├── .agents/skills/<name>/SKILL.md  the agent kit (decision 5's revision) — 14 of them:
│                                   add-sources · canonical-format-checker · content-refiner ·
│                                   deploy · docx · fetch-library-docs · find-skills ·
│                                   generate-flashcards · knowledge-extraction-method · pptx ·
│                                   quiz-generator · skill-creator · summary-generator ·
│                                   technical-clarity
├── .claude/
│   ├── rules/                   abstention · provenance · repository-map · review
│   └── settings.json            the vsor verbs pre-permitted; no hooks, nothing phones out
├── site/                        a REAL, thin Docusaurus shell — the seams agents know natively:
│   ├── docusaurus.config.ts     live themeConfig (title, navbar items, footer, prism — wired)
│   ├── sidebars.ts              the sidebar over `knowledge/`, named `tutorialSidebar`
│   └── src/
│       ├── css/custom.css       the design tokens, including --ifm-color-primary
│       └── pages/index.tsx      the homepage
├── AGENTS.md                    how an agent works in the scaffolded project
├── CLAUDE.md                    one line: `@AGENTS.md`
├── .env                         what the user supplies: DATABASE_URL + GEMINI_API_KEY
├── .gitignore                   ignores .vsor/, build/, .env, .DS_Store, .vercel/, .netlify/
└── (a git repository — init runs `git init` unless one exists)
```
<!-- /generated -->

**Why generated, recorded because it is the third failure of the same kind:** this tree was
maintained by hand and drifted four ways at once — it listed `vercel.json` and `netlify.toml` for a
day after they were withdrawn from the scaffold, it never gained `site/sidebars.ts` added the same
day, its skill count was checked by nobody, and the paragraph beneath it said 30 files against a
list of 31 when the truth was 29, having already carried 27-versus-28 forward once. The repair is
not the edit. One fact was living in a document held together by discipline, in the very file that
records the two previous times that discipline failed.

**The contract still lives in two places, and now they are pinned to each other:**
`tests/acceptance/init.sh` diffs real output against the full file list and
`packages/vsor/tests/test_init.py`'s `EXPECTED_FILES` pins the same set — deliberately, one per
language. `tests/test_generated_docs.py` asserts the two lists are identical and that both equal the
templates on disk. No prose anywhere states the count.

**Ownership destinations — one rule (settled 2026-08-13):** anything you take ownership of lands
where its *home system* already puts it, never in an invented location. When swizzling arrives, a
swizzled site component will land at `site/src/theme/<Component>/` (Docusaurus's own destination) —
*stated in the future tense 2026-08-14 because the fork does not read that path yet; see the
revision under settled decision 11.* Ejected kernel code →
`packages/<name>/` (the exact path it has in the framework repo), implemented as a local package
override that shadows only that one dependency — ejecting `sor-content` does **not** drag
`sor-platform` along; unejected deps stay installed. `vendor/` and `lib/` are dead as destinations.
`site/` stays at the project root: it is authored *input* (config, tokens, homepage), not a
runnable app — `apps/` would misdescribe it, and `packages/` appears only when an eject earns it.
If a second authored surface ever ships, `site/` → `apps/site/` is one documented move at a minor
version.

**Eject ergonomics (settled 2026-08-13):** no interactive init question about source — at minute 0
it is not a genuine decision (eve's own rule: ask only genuine decisions, automate the rest), and
ejection is the measured-rare rung. Instead: `vsor init --with-source` ≡ init + `eject all`, a
documented flag for those who already know. And **eject ships its own guardrails**: the ejected
package keeps its inline `EVAL-LOCKED` docstrings and negative-result fences; the command prints and
writes a do/don't card into the project's AGENTS.md (safe: composition, tool descriptions · locked
without recalibration: floors, chunk policy, embed recipe · must hold: generation authorization,
zero overlap, fail-closed · always: run `vsor eval` after kernel edits); `build.lock.json` marks the
build non-stock.

**Gateway composition (settled 2026-08-13): `vsor serve` IS the gateway.** Upstream's ~100-line
composition root (`gateways/sor-content/main.py`) becomes the implementation of `serve` — instance
read from disk instead of a bundle, `DATABASE_URL` and the embedding key from `.env`, snapshot keys
generated by `init`, the fail-closed auth dual-mode mapped onto settled decision 12. The kernel
calls (pool → `ServiceContext` → `build_component_server`, assembled on the serving loop) cross the
seam untouched. A user who outgrows the default — multiple instances, persona, hooks, different
exposure — writes a **new** gateway at `gateways/<name>/main.py` in their project, mirroring
upstream's grammar against the same declared seams: new owned code, never forked machinery. Not
scaffolded; appears when earned.

No `governance/`, no `evals/`, no `reflexes/` at level 0 — **empty scaffolded directories are
unanswered questions in the user's repo.** Directories appear when the ladder or the work demands
them.

## Repo layout — Phase 0 landed 2026-08-13; the rest arrives by slice

**Package-per-domain, kept deliberately.** A 2026-08-13 cross-repo study proposed collapsing to two
packages; the owner rejected it from direct experience — the upstream system ran this exact domain as
a monolith, paid for the split before release, and the split won. The boundaries are physical: each
package's tests run in its own environment, so a package cannot import what it does not depend on.

```
packages/
  vsor/             the CLI — the only thing a user installs (uvx vsor)
  sor-platform/     db · contracts · config          ← extracted
  sor-gateway-kit/  fail-closed auth · serve loop    ← extracted
  sor-content/      ingest · retrieval · abstain · generations  ← extracted
  sor-site/         the website surface (Node)       ← extracted; runtime-couples via build.lock.json,
                    build-time-couples via `make wheel` (its packed tarballs ship inside the vsor
                    wheel — amended 2026-08-13 with specs/vsor/build)
  sor-evals/        the proof + vsor.testing doubles ← extracted
templates/          what `init` copies — will be CI-built; evals will be green
tests/fixtures/tiny/      ~10 markdown files the tests run against
tests/
```

**The per-package tax is engineered out, not accepted:** all packages release in **lockstep at one
shared version** (no version-pin policing between siblings), and **one canonical command vocabulary
covers the workspace** — quoted here, called by CI, typed by humans and agents, so the three can
never drift. *Decided at the Phase-0 keyboard (2026-08-13): a thin **Makefile*** — it spans the Node package
arriving in slice 1 with zero new installs, where upstream's raw-`uv` pattern would have become two
vocabularies at that moment. `make gate` = lint · typecheck · test · boundary. Contributor tooling
only — users see the four `vsor` verbs, never this.

**Future domains arrive as new packages.** A write-authority domain (a learner record, an identity
record) gets its own package exactly as upstream holds them — the structure permits the family
without naming one. `sor-governance` is deferred with the ladder (level 1+) and arrives the same way.
Never create `knowledge/`, `governance/` or `instance.md` at this repo's root — those belong to
scaffolded projects.

## Tests and evals

> **The `CI` column says wired, not enforced.** As of 2026-08-15 no GitHub Actions job in this
> repository has ever executed — every run fails in 3–5 seconds on an account billing state, not a
> code fault (`gh run list` shows the history). Every tier below is real and is run locally by
> `make gate` / `make surface` / `make build-acceptance` / `make deploy-acceptance`; none has ever
> run in CI. An external reviewer did clone the repository on 2026-08-15 and run `make gate`
> (green, first attempt), `make wheel`, `vsor init` and a cold `vsor build` on a machine that is
> not the author's — so the suite is portable in fact, while the Node-dependent tiers have still
> never run on Linux. A second developer should read the column as intent until a green run exists.

**Test tiers** (copied from upstream, which runs 1,021 tests in ~12s):

| Tier | Selected by | May touch | CI |
| :--- | :--- | :--- | :--- |
| Unit | `tests/test_*.py`; `_pure` suffix where explicitly pure | memory + `tmp_path` only | ✅ |
| Boundary | the repo-root `tests/` suite (`make boundary`) — import graph, surface contract, and the documents-versus-source checks | reads source and shipped prose, parses with `ast`, never imports | ✅ |
| Composition smoke | `tests/test_*_smoke.py` | real composition root; fake pool that *raises if touched* | ✅ |
| Scaffold | one job | runs `vsor init` and builds the output | ✅ |
| Surface | `make surface` (Playwright over the built fixture site, B5–B13 + B15–B17 of `specs/sor-site/surface`; B14 retired 2026-08-14 with the stock configuration it named — B15 is the design-system tier: the utilities compute *and only the scanned ones*, the shadcn sheet is the mobile menu, lucide is inline SVG, a CSS-module primitive keeps its own box, code is legible in light mode; B16 is admonitions in both the v2 and v3 syntaxes; B17 is effective dating and supersession — the date reaches the page, the notice precedes the content, its successor link resolves and is walked, it keeps its box in both themes, and a document carrying neither key renders neither element. **B17 is numbered in code only**: the spec wording is queued with the lead, `specs/` not having been edited in the change that added it) | Node + pinned Chromium; static server on 127.0.0.1; deterministic by construction — DOM-state waits only, no screenshots | own job (needs Node) |
| Hosting | `make deploy-acceptance` (`tests/acceptance/deploy.sh`) — the two shapes a static host has, build-as-docroot and build-under-a-subpath, through the real wheel and a real browser. It is the only tier that reads `vsor build`'s own output rather than an assembled fixture, and the only one that ever serves at a prefix; both of those gaps hid real defects | Node + pinned Chromium; two static servers on 127.0.0.1 | own job |
| Database | `skipif` on an env pair | disposable local Postgres | opt-in |
| Eval | console scripts, not pytest | live provider | release gate |

One pytest invocation per package, in that package's own resolved environment — a package physically
cannot import what it does not depend on. The tier is defined by what a module does *not* do, never
by a marker or filename.

**Eval classes** — being explicit about which gates is the design:

| Class | Pins content identity? | Gates? |
| :--- | :--- | :--- |
| Behavioural — abstains out-of-corpus; citations resolve; unpublished generations never served | no | ✅ gates |
| Relevance — known question retrieves expected document | by slug | reported only |
| Correctness — externally authored ("must still say $500,000") | by content | ratchet; baseline may only grow |

Relevance never gates because its gold is generated *from the corpus under test* — a wrong rule
generates a gold question whose "correct" answer is the wrong rule. Out-of-corpus probes must include
**scope-adjacent near-misses**, not only far-domain questions.

## Kernel invariants

Each bought with a measurement upstream. They govern code being imported; they become live as
`packages/` fills.

- **The generation is the authorization.** Every chunk row and citation carries it; every snapshot
  token pins it; a surface refuses rows whose generation is not published.
- **Fail closed — once a floor is declared.** A *declared but uncalibrated* floor refuses. Level 0
  declares **no** floor: the gate is off and `/health` badges the server *uncalibrated — will not
  refuse out-of-corpus questions*. Honest absence, never silent weakness. (Whether a usable floor
  can be derived from a tiny corpus is v0's first experiment — see `docs/status.md`.)
- **Never copy a calibrated constant between corpora.** Recalibrate; record the measurement and date
  beside the number.
- **Abstention is an answer**, never an error, never a licence to fall back on model knowledge.
- **Record negative results beside the constant they explain.**
- **Zero chunk overlap.** Concatenating a node's chunks in ordinal order reproduces the body
  byte-exact.
- **Reproducibility is a testable claim:** same corpus tree + same embedder + same chunker ⇒ same
  `build_id` and chunk boundaries. Test by building twice and diffing `build.lock.json`.

## How we work

1. **Cite `file:line` — against the pinned SHAs in `docs/extraction.md` — or say you do not know.**
2. **One fact, one file.** Everywhere else is a pointer. (The set once carried one fact in four
   files; two had diverged.)
3. **Never write the present tense about behaviour that does not run.** If it is not built, say
   "will". This is the rule that protects all the others.
4. **Do not carry a mechanism across without asking what it was for.** A deployment tarball
   inherited from upstream survived four drafts and taught two cold readers a false product before
   anyone checked what it actually contained.
5. **Supersession is visible.** A reversed decision keeps its entry and gains a revision note.
6. **Decisions are recorded here, in the same change that acts on them.**
7. **Derive names from paths.** No `id:`/`name:` field on what location already identifies.
8. **One obvious way.** Agents sample across options; a golden path is a compatibility guarantee.

## How we build

The code-era rules; they bind the day the first package lands. Precedent: upstream's ratified
`specs/` contracts and eve's research-doc-for-public-APIs rule.

1. **Spec-driven where it counts — never for small things.** A change gets a spec at
   `specs/<package>/<feature>/spec.md` only when it (a) alters a public surface — CLI verbs,
   scaffold contents, MCP tools, response envelopes, `build.lock.json`, the schema — or (b) crosses
   a package boundary, or (c) is expensive to reverse, or (d) will be built unattended by an agent.
   Everything else: the commit and its tests are the record. A spec is one page — frontmatter
   (`status: draft | ratified | superseded`, date), **the business claim it serves**, the externally
   observable contract, the acceptance test, out-of-scope. No speculative implementation detail.
   Where a ratified spec and code disagree, the code wins and the spec is corrected in the same
   commit. The `specs/` directory appears with the first spec — never before.
2. **Every change names its business claim.** The five-minute promise · honest abstention ·
   ownership-by-scaffold · the 80/20 · cost-stays-flat. Work that cannot name which claim it serves
   does not get built.
3. **Compose before you write.** A new capability is first a composition of existing pieces through
   existing contracts; net-new code states why composition failed.
4. **Small increments.** The smallest change that proves the next assumption — the framework obeys
   the book's own thin-slice method on itself.
5. **Live-first, like a user.** Before a feature is done, its real path is walked — by hand or by an
   agent driving the actual CLI (`init → build → serve → ask`). What the live run teaches is
   recorded beside the code; upstream's `found live …` comments are the model.
6. **Proof rides with the change.** Nothing lands without its tests; nothing model-visible lands
   without its eval rows (gate / scored / tracked). Evals are not a later phase — a feature without
   proof is not done.
7. **Detail is the product.** Error text carries the remedy; every `--json` envelope is a contract;
   measured constants carry their date and method; first-run and empty states are reviewed as
   deliberately as the kernel.

The implementation form of these rules is a skill: **`.agents/skills/implement-spec/SKILL.md`** —
breakdown per aspect, red acceptance first, aggressive self-review, live verification like a human
(browser included for anything with a page), the detail pass, the truth sweep. Load it before
writing the first line of any spec's implementation.

## Two design tests

Recovered 2026-08-13 — lost in the doc consolidation; they are the deepest output of the design
review and apply to every decision below the invariants.

- **Governs acts, not artifacts.** Ask of every mechanism: *which act does this constrain, who
  performs it, and what row exists afterwards proving they did* — not *what field does this add to a
  register*. Rights checked at ingest but not at serving, approval attached to a corpus but not to
  an answer, audit rows that cannot replay a read — all fail this test.
- **Provenance is not correctness.** Everything here proves *who said something and when*. The
  expert's judgment — whether a source is contested, a minority position, or overtaken — is the
  commercial surface, and it is precisely the ungoverned part. When adding a mechanism, name which
  of the two it serves; never sell a provenance mechanism as a correctness one.
  *Revision 2026-08-15: this bullet used to say "nothing yet expresses that a source is contested,
  a minority position, or superseded". One third of that is now false. **Supersession is
  expressed** at level 0: three optional frontmatter keys on a document (`effective`,
  `superseded`, `superseded_by`), a notice rendered above the content of a document that is no
  longer current, and a build-time refusal (`error: knowledge-invalid`) of a pointer naming a
  document the build does not publish — `packages/vsor/src/vsor/knowledge.py` and
  `packages/sor-site/app/src/theme/DocItem/Content/EffectiveDating.tsx`. It is a **correctness**
  mechanism and is the first one here, which is why it is named as such rather than folded in with
  the citation machinery. Contested and minority positions remain unexpressed, and so does every
  temporal question beyond "is this document current" — chains, ranges, as-at queries and the MCP
  surface's use of any of it are slice 2.*

## Authority

1. **Upstream code** beats every document here — read it at the pinned SHAs and cite it.
2. **This file** is authoritative on vocabulary, settled decisions, invariants, and process.
3. **`docs/status.md`** is the only authority on what is actually built and what to do next.
4. **Superseded documents live in git history, not the working tree.** The research that produced
   this design is preserved in the root commit (`git show 0f9f8c3 -- docs/archive/`); nothing
   non-authoritative sits where a search can hit it.

## Definition of done

- The acceptance assertions in `docs/status.md` pass on a clean machine.
- Tests exist and run under the project's runner.
- Any document the change made false was corrected in the same commit.
- Any decision taken was recorded here; any question answered was struck from `docs/status.md`.
