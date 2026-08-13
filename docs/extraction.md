# Extraction — the work list for the join

Surveyed 2026-08-11 against these commits. **Every `file:line` in this document is a coordinate into
these SHAs**; re-verify before relying on a citation if either repo has moved.

| Repo | SHA |
| :--- | :--- |
| `~/Documents/code/sor-agentfactory` | `ac5ebf7259fad71de6ac4a20db1ecb7da7aa1a79` |
| `~/Documents/code/panaversity-official/tutorsgpt/ag2` | `d764f334fc4da19edd7e2531a86fdc234f1a366c` |

> ⚠️ **Copy permission is not yet granted** — see the blocker table in `status.md`. Read and cite
> freely; do not move code until it is.

## The thesis

Two monorepos have each independently extracted half a kernel. `ag2/libs/docusaurus/*` is the
**website surface's** kernel (nx, JS, 14 packages). `sor-agentfactory/packages/*` is the **MCP
surface's** kernel (uv, Python, six packages, ~70% genericized already). They share a corpus and
nothing else — no config, no build, no provenance chain. **The framework is the seam between them.**
Do not rebuild what they already do; the job is to move, join, and de-brand.

---

## Python side (`sor-agentfactory`)

`gateways/sor-content/` is a 111-line composition shell; the machinery is `packages/sor-content/`
(37 modules, ~7,300 lines, 303-line `schema.sql`) over `sor-platform` and `sor-gateway-kit`.

### Already parameterized — do not redo

- Tool names from `brand` (`instance.py:217-223`) → `search_{brand}` etc., MCP-legal validated.
- DSN env var *name* from `instance.md`; nothing hardcodes a deployment.
- Tenant, floors, budgets, server instructions — all instance config; tool-description override
  chain product > instance > default (`tooldesc.py:41-58`).
- `content_nodes.kind` is free-text with no CHECK — adapter-defined vocabulary already.
- `plain_tree.py` (195 lines) — a working generic folder-of-markdown adapter.
- Generation / flip / GC / snapshot / RLS / audit machinery — domain-agnostic.

> **Correction (2026-08-12):** an earlier version of this list said "multi-corpus is already
> `corpus_id`." **False.** `corpus_id` exists on `corpora`, `ingestion_runs`, `takedown_denylist`,
> `retrieval_log` — and on **none** of the five content tables (`content_nodes`, `sources`,
> `chunks`, `slug_aliases`, `node_centroids`). Adding it is real work (settled decision 9).

### Must fix on the way across

**The sharpest trap:** `_wire_params.py:82,95` embeds the literal strings `search_agent_factory` /
`outline_agent_factory` *inside parameter descriptions*. Set `brand: accounting` and you ship
`search_accounting` whose own docs tell the model to call `outline_agent_factory`. Template the
descriptions on `brand`; re-freeze the byte-identity baseline per brand.

| Item | Where | Fix |
| :--- | :--- | :--- |
| ~5.6KB of tool-description prose is Agent Factory ("curriculum", "learner", "lesson") | `tools/*.md` | generic templates with instance-supplied slots — override mechanism exists |
| Domain noun in the API: `read_{brand}_lesson` | `tools.py` | instance field `unit_noun: lesson\|document\|record\|case` |
| Adapter hardcodes `apps/learn-app/...` paths | `docusaurus_sidebar.py:150-151,354,516` | move to instance `corpus:` block |
| Curriculum-shaped instance fields (`crash_courses_tree`, `opening_page`…) | `instance.py` `_RawCorpus` | adapter-specific sub-object the kernel passes through opaquely |
| Chunking classifiers name Quiz/Flashcards/AICheck etc. | `chunking.py:24-28,250` | instance-configurable lists (CHUNK_POLICY-versioned, correctly forces re-embed) |
| `lib/steps.py` + `service.course_map` are pure education | 168 lines | out of the kernel into `sor-curriculum` |
| Advisory text says "UNTRUSTED curriculum text… for the LEARNER to run" | `service.py:353-363` | parameterize per instance |
| `retrieval_log.action` closed 7-value CHECK — **and the recorded scar:** `'generation_rolled_back'` was missing, so the audit INSERT aborted the transaction and **the automated rollback never actually rolled back** (`generation.py:348-351`) | `schema.sql` | seeded lookup table |
| Education hook names (`on_lesson_served`, `for_this_learner`) — mechanism is generic, names are not | `service.py`, `tools.py:53` | rename neutrally |
| Frozen wire schema advertises `k ≤ 1000`; service clamps at 50 | `_wire_params` vs `service.py:45` | re-freeze honestly |

### Two verified seams

**FTS language is hardcoded English** at six sites, with a *strict* frontmatter binder
(`sor-platform/frontmatter.py:141-144` rejects unknown keys), raw-SQL schema application, and a test
pinning the literal (`test_schema_contract.py:15`). Query side is easy (`websearch_to_tsquery` takes
a `regconfig` param); the hard part is the `STORED GENERATED` tsvector column — per-instance means
templating the DDL, and the column is table-wide, so **two corpora in one database cannot differ in
language**. A non-English vertical needs its own database.

**Embed model is fixed in the image, deliberately** (`config.py:8`, eval-locked). The serve-time
drift check compares one string and is **alerting-only, never fail-closed**. Fine to inherit; do not
mistake it for enforcement.

### Ingest changes at the seam

Upstream ingests via a digest-verified archive fetched at boot (`load_bundle`) because its gateway
is a stateless container with no checkout. **That mechanism does not cross the seam.** In this
framework the corpus is on disk in the user's repo: ingest reads `knowledge/` directly, and
**the generation — not any digest — is the authorization** (`AGENTS.md`, kernel invariants). The
archive machinery stays behind as an upstream deployment detail.

### Carry across unchanged

- **Generational rebuild with eval-before-flip.** Build invisibly at N+1, carry embeddings forward
  by content hash (cost scales with *change*), gate on health + shrink + an acceptance eval pinned
  to the candidate while the old generation still serves, then flip one pointer monotonically.
  Failure mode is staleness, never corruption.
- **Calibrated abstention with negative results recorded in source.** `vector_floor: null` = gate
  off + `/health` loud. `keyword_floor` is null because `ts_rank_cd` provably does not separate
  (`abstain.py:41-47`) — the failed experiment lives beside the constant. **Never copy `0.634`**;
  it belongs to that corpus at that scope (calibration: 416 gold + 38 OOC probes).
- **Zero-overlap chunking** — byte-exact reconstruction is a tested invariant.
- **Hybrid RRF retrieval** (k=60, tie-breaks on chunk_id, takedown applied pre-fusion, generation
  pinned once per query in a CTE).

### Two testing ideas worth stealing

- `test_wire_surface.py` asserts **byte-identity** of tool descriptions and param schemas against a
  frozen baseline — what makes the agent-facing contract *kept* rather than intended.
- `ingest/audit.py` is a re-runnable corpus linter, explicitly **no-database by design** (a check
  needing Postgres would not run in CI), whose docstring records three failed regex approaches so
  nobody re-spends the day.

---

## JS side (`ag2`)

`learn-app` is not a monolith: `ag2/libs/docusaurus/` already holds **14 shared packages** the app
consumes as a client.

**Move mostly intact:** `shared/siteConfig.js` (url/baseUrl from env — the white-label seam),
`normalizeToDocId`, `flashcardLoader` + `galleryLoader`, `plugin-og-image`, `plugin-structured-data`,
`chapter-manifest-plugin`, `summaries-plugin`, `remark-flashcards` (tested),
`remark-content-enhancements`, `remark-gallery`, `remark-normalize-relative-links`.
`remark-interactive-python` is curriculum-flavoured — opt-in. **Collapse the five near-identical tab
remark plugins into one configurable `remark-tabs` before extracting** — never carry known
duplication across a seam.

**The exclusion list is now contract, not work-list:** `specs/sor-site/surface/spec.md` binds it
with CI enforcement — a dependency **allowlist** (denylist as lockfile backstop), a parse-based
boundary test over shipped source and built bundles, and a Playwright tier whose network
interception proves at runtime that the theme introduces no external requests. This section
remains the survey; the spec is the authority.

**Token cleanup is extraction work, not later work:** upstream's `doc-pages.css` is 3,997 lines
carrying 82 `oklch()` + 130 hex literals, which is why `--ifm-color-primary` recolors nothing
there. The spec's token-discipline gate is baseline **zero** — reducing those 212 literals to
tokens happens *before* the CSS crosses the seam (never carry known debt across a seam).

**Kernel components in the app** (~14 of ~50 dirs): `quiz/`, `flashcards/`, `ui/`, `ExerciseCard/`,
`HighlightTip/`, `ImageZoom/`, `ReadingProgress/`, `SearchBar/`, `gallery/`, `cheatsheets/`,
`explorers/`, `LessonContent/`, `DocPageActions/`, `ModeToggle/`.

**Product — must not enter the framework:** the other ~30 component dirs (auth, gating, tutor
panels, practice, onboarding, admin), all 12 `customFields` (each points at a sibling app in
`ag2/apps/`), and the deps that leave with them (`better-auth`, `@openai/chatkit-react`, monaco,
xterm, ts-fsrs, recharts). Navbar/Footer swizzles need unpicking; `DocItem`/`Layout` are closer to
kernel.

**Branding to lift into the instance:** title/tagline/favicon (`docusaurus.config.ts:482-485`), org
and project names (528-529), OG/Twitter block (1017-1040), navbar title (1053), footer + copyright
(1114-1178). Already env-driven, keep: `SITE_URL`/`BASE_URL` only.

> **Correction (2026-08-13):** this list previously said keep GA4, i18n config, and the runtime
> `data-brand` hostname white-labeling (541-551). All three are now **excluded** by the surface
> spec's negative contract: the theme carries zero analytics code even env-gated; branding is
> instance config at build time, so the runtime brand switch has no job here; i18n is deferred
> wholesale post-v0.

**Search** is `@easyops-cn/docusaurus-search-local` — local index, no external service. Keep.

**Content conventions that already agree across the seam:** frontmatter (`title`, `sidebar_label`,
`sidebar_position`, `description`, `keywords`, optional `slug`) — and `stable_id` derives from the
*path*, not `slug`, on both sides without shared code. `<Quiz />` props are vertical-agnostic
(exactly four options, `correctOption` index, optional `explanation`/`source`) — a kernel primitive
as-is.
