> **ARCHIVED 2026-08-12 — not authoritative, not in the reading order.**
> Superseded by the consolidated set: `AGENTS.md` (durable), `docs/status.md` (weekly),
> `docs/extraction.md` (the join work list). Kept because the reasoning is real work.
> Known defects at archive time are corrected in the live set, not here.

---

# Extraction inventory — `sor-content` → the agent door

Source: `~/Documents/code/sor-agentfactory`
Surveyed 2026-08-11. Companion to `docs/archive/2026-08-11-design-study.md` (archived — **not authoritative**; see `AGENTS.md` and `docs/status.md` for what is live). Line numbers are as-surveyed.

---

## 0. The headline

`gateways/sor-content/` is **not** the service. It is a 238-line composition shell (111 source lines
across three files). All the machinery is in `packages/sor-content/` — 37 modules, ~7,300 lines plus
a 303-line `schema.sql` — over `sor-platform` (bundles, db, auth, kv, limits) and `sor-gateway-kit`
(auth seam, serve loop, ASGI hardening).

**The codebase has already done roughly 70% of the kernel extraction and knows it.** It separates
domain library / instance config / gateway composition, generates tool names from a `brand` field,
and already ships a second, fully generic adapter (`plain_tree.py` — any folder of Markdown becomes
a corpus). What remains Agent-Factory-specific is narrower than expected, but non-obvious in places.

---

## 1. Already parameterized — do not redo

- **Tool names from `brand`** (`instance.py:217-223`) → `search_{brand}`, `outline_{brand}`,
  `read_{brand}_lesson`, validated against `^[a-z][a-z0-9_]*$` for MCP legality.
- **The DSN environment variable *name*** comes from `instance.md` (`database.dsn_env`). Nothing in
  code hardcodes a deployment.
- `tenant_id`, `corpus_id`, abstain floors, response budget, and the server instructions are all
  instance config.
- **Tool-description override chain**: product > instance > component default (`tooldesc.py:41-58`).
- `content_nodes.kind` is free-text `TEXT` with **no CHECK constraint** — an adapter-defined
  vocabulary already.
- `plain_tree.py` (195 lines) — a working generic folder-of-Markdown adapter.
- Bundle / digest / generation / flip / GC / snapshot / RLS / audit machinery — fully domain-agnostic.
- Calibration out-of-corpus probes (`calibrate.py:85-106`) are deliberately corpus-independent.

## 2. Must fix — hardcoded to the Agent Factory

**The sharpest trap: frozen wire-param descriptions embed the brand.** Tool *names* are generated,
but `_wire_params.py:82,95` — which feeds every `Field(description=…)` — embeds the literal strings
`outline_agent_factory` and `search_agent_factory` **inside the descriptions**. Set
`brand: accounting` and you ship `search_accounting` whose `slug` parameter tells the model to call
`outline_agent_factory`. *Fix:* template param descriptions on `brand` at registration; re-freeze the
byte-identity baseline per brand.

| # | Item | Where | Fix |
| :-- | :--- | :--- | :--- |
| 2 | ~5.6KB of default tool-description prose is entirely Agent Factory ("the canonical curriculum", "learner", "lesson/course") | `tools/{search,outline,read_lesson}.md` | Generic templates with `{brand_title}` / `{corpus_description}` slots; vertical prose becomes an instance override — the mechanism already exists |
| 3 | Domain noun in the API surface: `read_{brand}_lesson` returning `{slug,title,text,sections}` | `tools.py` | Add instance field `unit_noun: lesson\|document\|record\|case` |
| 4 | Docusaurus adapter hardcodes paths: `apps/learn-app/docusaurus.config.ts`, `…/docs`, `agent-factory-content.tgz` | `ingest/adapters/docusaurus_sidebar.py:150-151, 354, 516` | Move to the instance `corpus:` block |
| 5 | Instance schema fields are curriculum-shaped: `crash_courses_tree`, `crash_courses_title`, `opening_page`, `opening_sections`, `opening_token_budget` | `instance.py` `_RawCorpus` | Rename neutrally, or push into an adapter-specific sub-object the kernel passes through opaquely |
| 6 | Chunking classifiers are Docusaurus + Agent Factory: `<(Quiz\|Flashcards)`, `<(iframe\|AICheck\|ProjectCard\|CapstoneWorkbook)`, `"docs.google.com/presentation"`, `"Teaching Aid"` | `ingest/chunking.py:24-28, 250` | Instance-configurable component lists. Note this is `CHUNK_POLICY`-versioned, so a change correctly forces re-embed |
| 7 | `lib/steps.py` (168 lines) is **pure education** — a denylist of recaps/flashcards/prove-it globs, `^part-\d+`, `derive_steps`, `served_steps`, `leaf_units` | `lib/steps.py`, `service.course_map` | Extract out of the kernel entirely into a `sor-curriculum` vertical package, taking `CourseMap` with it |
| 8 | Advisory and directive text tuned to a coding curriculum ("paste this prompt into your agent"); `_CONTENT_ADVISORY` literally says "UNTRUSTED curriculum text… meant for the LEARNER to run" | `service.py:353-363` | Parameterize the advisory string; make the regex instance config — an accounting SoR wants different injection shapes, or none |
| 9 | `_strip_asset_markup` / `_SVG_RE` — book-specific inline-diagram trim | `service.py:326-344` | Harmless, but make it an opt-in flag |
| 12 | `retrieval_log.action` CHECK is a **closed** 7-value vocabulary | `schema.sql` | Widen or drop — `rlog.py:28` already keeps an app-side `_READ_ACTIONS` frozenset. **See the scar in §7** |
| 13 | Learning-domain hook naming: `on_lesson_served`, `teaching_context_provider`, response key `for_this_learner` | `service.py`, `tools.py:53` | The mechanism is properly generic (opaque callables, content stays blind); only the names are education. Rename to `on_document_served` / `context_provider` / `for_this_actor` |
| 15 | Small ones: `ingest/gc.py:51` defaults `--instance` to `instances/content/agent-factory`; the gateway prints a name literal; `ingest/drift.py` scans root-level markdown only | — | Mechanical |

### Two config seams, verified

**FTS language is genuinely hardcoded — there is no config path defaulting to English.** Six sites:
`schema.sql:116` (the `STORED GENERATED` column), `lib/search.py:86,89,113,117`, plus
`sor-evals/driver_bakeoff/schema.sql:26` and `harness.py:60,62`. `_RawRetrieval` (`instance.py:115-123`)
carries only `vector_floor` and `keyword_floor`; the frontmatter binder is **strict**
(`sor-platform/frontmatter.py:141-144` raises on unknown fields), so an operator cannot even sneak the
key in. `schema.sql` is applied as a raw file by `scripts/bootstrap-prod.sh:16,25` with no
templating, and `tests/test_schema_contract.py:15` actively pins the literal.

Three consequences that decide the fix:
- The query side is easy — `websearch_to_tsquery` accepts a `regconfig` parameter, so
  `websearch_to_tsquery(%(tscfg)s::regconfig, %(query)s)` works without SQL interpolation.
- The stored column is the hard part: an expression inside `GENERATED ALWAYS AS … STORED` cannot take
  a parameter and must be `IMMUTABLE`, so per-instance means templating `schema.sql` at apply time —
  which does not exist today.
- **The column is table-wide, not generation-scoped, so two corpora in one database cannot differ.**
  A non-English vertical needs its own database, not just its own tenant.

**Embed model is fixed in the image, deliberately.** `config.py:8` `EMBED_MODEL = "gemini-embedding-001"`,
and the module docstring draws the line explicitly: eval-locked constants live here, while
"deployment-varying knobs (floors, budgets, DSN env names, tenant)… live in the instance definition."
`server.py:31-34` documents the hazard: the model ships in the image, not the bundle, so the
bundle-SHA drift check cannot see a model bump. The serve-time check (`_recipe_note`, `server.py:30-43`)
compares **one string** — the `embedding_model` stamped on the served generation's `sources` rows
versus the process constant — and is **alerting-only, never fail-closed**. It does not compare
dimension or task type; `config.py:15-17` explains why (dim is enforced by the `vector(1536)` column
type; a task-type change is not observable in stored rows and is the operator's `FORCE=1`
responsibility).

**Leave table and role names alone.** Multi-tenancy is `tenant_id` + forced RLS; multi-corpus is
`corpus_id`. A second vertical should be a second tenant or database, not a table prefix. Renaming
buys nothing and costs every SQL constant.

**Recalibrate, never copy.** `vector_floor: 0.634` is specific to this corpus at this scope
(history: 0.58 → 0.625 → 0.634 as the corpus grew). `sor-content-calibrate` exists for this.

---

## 3. Module map

```
gateways/sor-content/src/sor_content_gateway/   111 source lines
  main.py 100   _ring_from_env() + async _build() — assembled ON the serving loop
                (pool workers must live on the loop uvicorn serves from)

packages/sor-content/src/sor_content/           37 files, ~7,298 lines
  config.py         25  EVAL-LOCKED constants
  db.py            157  pool spec: run_read / run_probe / run_audit / run_ingest
  instance.py      289  parse_instance() — the instance.md contract
  service.py       902  composed ops: search / read_lesson / outline / course_map
  server.py        209  FastMCP assembly + /live /ready /health
  tools.py         183  MCP registration — the ONE file touching the SDK
  tooldesc.py       59  compiled descriptions, product > instance > component
  _wire_params.py  123  FROZEN generated param schemas
  calibrate.py     358  risk-coverage curve → abstain floor
  lib/    abstain 50 · embedding 170 · query_embed 170 · read 351 · readcache 308
          rlog 82 · search 376 · snapshot 99 · steps 168 · version_pointer 50 · windowing 138
  ingest/ adapters/docusaurus_sidebar 598 · adapters/plain_tree 195 · build 213 · chunking 387
          cli 178 · generation 425 · manifest 140 · markdown 42 · rendered 265 · worker 87
          audit 142 · audit_cli 94 · drift 78 · drift_cli 66 · gc 57
  schema/schema.sql 303
  tools/{search,outline,read_lesson}.md
```

Python **3.14 is load-bearing** — `service.py:300` uses PEP 758 `except LookupError, ValueError:`,
which will not parse on ≤3.13. Runtime deps: `sor-platform`, `psycopg[binary]`, `psycopg-pool`,
`pgvector`, `google-genai`, `tenacity`, `mcp>=1.9,<2` (confined to `tools.py`/`server.py`; `lib/`
stays SDK-free and this is boundary-tested). Optional `rendered` extra pulls
`beautifulsoup4` + `markdownify`, lazily imported so the serving image carries no HTML parser.
CLI entry points: `sor-content-{ingest,calibrate,drift,audit,gc}`. mypy **strict**.

The Dockerfile uses manifest-COPY layering, `--no-editable` (deliberate — editable installs leave
`.pth` links the runtime stage does not carry), non-root uid 10001, and bakes **no** instance or
product bundle: bundles arrive at boot via URI + SHA256. **The image is already corpus-agnostic.**

---

## 4. The MCP surface

Official Anthropic SDK (`mcp.server.fastmcp.FastMCP`), streamable HTTP, **`stateless_http=True`,
`json_response=True`** — with `maxScale>1` and no session affinity, a stateful server 400s every call
routed to an instance that never saw `initialize`. **No resources, no prompts** — tools only, plus
`/live`, `/ready` (200/503) and `/health` (instance, corpus, abstain gate, freshness, embed-recipe
drift, config drift, cache stats).

**`search_{brand}`** `(query, grain="passage", k=10)` → `{hits:[{slug, heading_path, content,
rrf_score, provenance{corpus_id, stable_id, slug, generation, retrieved_at}, url?, grain?,
truncated?}], abstained, snapshot{corpus_id, generation, token, expires_at}, note?,
content_advisory?, k_note?, degraded_reason?}`.
⚠️ **Divergence:** the frozen wire schema advertises `k` max 1000; `service.py:45` clamps to
`MAX_SEARCH_K=50` and returns a `k_note`. The baseline was frozen before the clamp landed.

**`outline_{brand}`** `(node?)` → `{nodes:[{slug, kind, title, heading_path, position, depth,
child_count, has_content, url?}]}`, root-absolute depth. `tools.py:88-91` records that `query` and
`scope` were **deliberately dropped** — outline is browse-only. Note the centroid machinery
(`CENTROID_SQL`, `aboutness_order`, `rank_nodes_by_hits`) is still built and materialized but
**unreachable from any exposed tool**.

**`read_{brand}_lesson`** `(slug, section?, heading?, from_heading?, snapshot?)`. `section`/`heading`
are aliases for subtree scope (both → raise); `heading` + `from_heading` **is** legal, and required
for the `next` cursor to be reachable inside a bounded section.

**Annotations are derived, not hardcoded** (`tools.py:159-183`): `readOnlyHint=True`,
`openWorldHint=False` unless the composition injected a witness hook. Reason recorded at `:153-158` —
claude.ai groups connector tools in the permission dialog *by these hints*, and with no annotations
all three landed in "Other" (measured live 2026-07-25).

**Hook ordering invariant worth stealing** (`tools.py:114-118`): enrichment fires *before* the
witness, because the witness stamps the read as taught and enrichment after it reports the read's own
footprints — "observed live 2026-07-24: a first-ever read claimed 8 covered sections."

**Auth** (`sor-gateway-kit/auth.py:77-111`), three fail-closed gates: not-disabled with no SSO config
raises; auth-on with an empty `SOR_JWT_ALLOWED_AUDIENCES` raises ("would accept any SSO-signed token"
— the confused-deputy case); `SOR_AUTH_DISABLED=1` returns `(None, None)` as a deliberate opt-out.
`harden.py` adds HSTS, nosniff, a 1MB body cap on both declared and chunked lanes, and a 308 from the
bare `/.well-known/oauth-protected-resource`.

---

## 5. Retrieval

```python
EMBED_MODEL = "gemini-embedding-001"
EMBED_DIM = 1536      # MRL truncation of native 3072; truncation MUST re-normalize
EMBED_TASK_DOCUMENT = "RETRIEVAL_DOCUMENT"; EMBED_TASK_QUERY = "RETRIEVAL_QUERY"
RRF_K = 60
CHUNK_POLICY = "heading-aware-1500-content-only-v5"
MAX_CHARS = 1500; NAV_MAX_CHARS = 250; HARD_MAX_CHARS = 4000; MIN_CONTENT_CHARS = 24
CHARS_PER_TOKEN = 4
```

**Vector arm:** asymmetric task types, 1536-d via `output_dimensionality`, **mandatory L2
re-normalization** (only the native 3072 arrives normalized), degenerate-vector rejection (a NaN
cosine poisons ranking). Index `hnsw (embedding vector_cosine_ops) WITH (m=16, ef_construction=64)`,
operator `<=>`. Runtime GUCs folded into the single `set_config` round-trip:
`{"hnsw.iterative_scan": "relaxed_order", "hnsw.ef_search": "100"}` — `iterative_scan` is
**recall-critical** under the tenant/generation post-filter, and the pairing is test-enforced.

**Document embed input** (bake-off winner): `f"{title} > {heading_path}\n\n{content}"`. **Queries
embed plain.** Keyword arm has **no field weighting** — title and heading influence only the vector
arm, via the embed input.

**Fusion** (`search.py:74-104`): RRF with k=60, candidate pool n=30 per arm, tie-break on `chunk_id`
everywhere, generation pinned once in a `g` CTE so a concurrent flip cannot tear the result set,
**takedown applied pre-fusion** (a denied hit must not even influence ranks), and `top_vec_sim`
riding out of the *same* HNSW walk rather than a second query.

`split_hits()` is the single unpack point, with a runtime assertion that
`cur.description[n].name == "top_vec_sim"`. Its docstring records why: three call sites hand-counted
columns, `permalink` landed mid-projection, and `measure.py` read the permalink **string** as the
abstention cosine "for the whole life of the column."

**Abstention** (`lib/abstain.py`, 50 lines): `vector_floor is None` → gate OFF and `/health` loud;
otherwise abstain when `top_cosine < floor`. `keyword_floor` is deliberately null, with the
**negative result recorded in the source**: on 416 gold + 38 OOC queries through the real
`KEYWORD_SQL`, `ts_rank_cd` does not separate — vague OOC fragments score above the in-corpus median,
and every leak-stopping floor false-abstains 67–98% of real queries.

**No reranking** (Cohere retired 2026-07-16 — "a parsed-but-never-called gate was a silent no-op if
enabled"; the field is accept-and-ignored purely so HEAD can load a pre-retirement bundle). **No query
rewriting** — whitespace normalized only, case deliberately not folded.

**Degraded path:** embed failure → keyword-only with `degraded_reason`, never cached. Query embedding
has a 10s circuit breaker *plus* a 5s wall-clock `wait_for`, because the breaker only fires on raised
errors and a provider **hang** defeats it. Single-flight with shielded waiters, L1 LRU 10k, Redis L2
keyed `sor:emb:{model}:{task}:{dim}:{sha}` checked *before* the breaker gate.

---

## 6. Schema

One file, no migration runner; compatibility is a range in `schema_meta`. **The hierarchy is one
recursive table** — not lesson/section/passage tables. Within-document heading hierarchy lives on the
chunk as a path, not as rows.

`corpora` (active + rollback generation) · `ingestion_runs` (state ∈ building/ready/active/retired/
abandoned/reaped, `source_commit`, `instance_bundle_sha256`, heartbeat) · **`content_nodes`**
(recursive, `stable_id`, `parent_id`, `kind` free-text, `slug`, `permalink` — a *confirmed* site
route, NULL rather than a guess — `status`, five constraints incl. a self-parent check and a
tenant-scoped parent FK with `ON DELETE RESTRICT`) · `slug_aliases` (flattened at ingest) ·
`sources` (path-derived `source_id`, `content_hash` of the cleaned body, `embedding_model`,
`chunk_policy`, `modality` — always `'prose'` today and filtered on at `read.py:77`, an unused
extension point) · **`chunks`** (`chunk_hash` = the carry-forward key, `heading_path` JSONB +
`heading_path_text` slug breadcrumb indexed `text_pattern_ops` for `LIKE 'prefix/%'` subtree queries,
`anchor`, `labels` JSONB, `VECTOR(1536)`, `embedding_status` with a CHECK that embedded implies
non-null, the generated `search_tsv`) · `node_centroids` (materialized at finalize, never averaged at
query) · `takedown_denylist` (**no generation column by design** — denial beats every generation) ·
`retrieval_log` (partitioned by range on `created_at`, `actor` with no default so unset errors loudly).

**Triggers:** `touch_updated_at`; and `sources_one_model()` — **one embedding model per tenant,
enforced in the database**, raising a named exception, because a model switch is a deliberate full
re-embed.

**RLS:** all nine tables `ENABLE` **and `FORCE`**, so even a table owner obeys. The tenant wall is
`current_setting('app.tenant_id', true)` and **unset yields zero rows**. Ingest policies additionally
require a row in `ingest_tenant_grants` matching `current_user` — "a CLI flag is not authorization."

Slugs versus URLs: `slug` is the tree address, `permalink` the confirmed site route; they diverge
whenever a page sets frontmatter `slug:`, and `site_base_url` is joined at **serve** time, so moving
the site needs no re-ingest.

---

## 7. Ingestion

**Bundle-mediated and adapter-agnostic.** The kernel never sees the source repo — it sees a
`manifest.json` plus files inside a digest-pinned tarball. `manifest.py:1-5` states the thesis:
*"plain-tree emits the same shape from a directory tree — the kernel cannot tell them apart."*
Ingest never re-derives taxonomy.

**Publish:** parse instance → build manifest (bracket-match the `const groups` literal, resolve every
sidebar id fail-loud, `stable_id` from frontmatter `sor_id` else the docs-relative **path**) →
`resolve_shell_bodies()` (MDX component shells get prose from rendered HTML; a declared shell with no
`corpus.rendered` is a hard error) → **`resolve_permalinks()`, the sitemap-confirmation step**: fetch
`/sitemap.xml`, and a route the live site does not list is **dropped, never stored**; a fetch failure
degrades to "no page links this build" rather than failing the publish → `_write_bundle()`, a
**byte-reproducible** tgz built with `mtime=0`, zeroed uid/gid/uname, sorted entries, then gzipped via
fileobj with `mtime=0` so gzip cannot stamp wall-clock into the header. **The sha256 is the deploy
authorization.**

**Ingest:** `load_bundle` (digest verified *before* any parse; zip-slip, symlink and bomb caps) →
`allocate_run` (per-tenant `pg_advisory_xact_lock`; generation = max+1) → `build_structure` (nodes
topological → sources → pending chunks → carry-forward) → **drop the build transaction** → drain the
embed queue in batches of 32 holding no connection → `finalize` (health gate + model gate + centroids
→ `ready`) → optional shrink guard → `flip` → invalidate the Redis version pointer post-commit.

**Chunking:** parse frontmatter then **`del meta`** (taxonomy comes from the manifest, not
frontmatter) → strip `<style>` blocks (fence-safe) → strip presentation JSX (`style={{…}}`
brace-matched because they span 168 lines; wrappers left **bare**, keeping the text and dropping the
tag — a tag is only stripped once bare, which is the whole safety argument, with a document-wide tag
stack so openers and closers pair across fence splits) → hash the cleaned body → `chunk_text`.

Heading-aware, not fixed-window: H1–H4 count only outside fences, every line lands in exactly one
segment, sub-splits flush only outside a fence, and a character slice happens in exactly one place
(`_enforce_ceiling` at 4000). **Overlap is zero** — concatenating chunks in ordinal order reproduces
the body **byte-exact**, which is the tested invariant behind byte-exact reads and lossless windowing.
Classification sets `labels.source_type` ∈ assessment / embed / nav / prose; **only `prose` is
servable**.

**Re-sync is a generational rebuild with content-addressed carry-forward** — not incremental upsert,
not full re-embed. A vector is copied only when the *entire* embed input is unchanged: same
`source_id`, `chunk_hash`, `heading_path_text` **and node title**, and the same model (the R-1 gate).
An embedding is a pure function of (embed input, model), so identical input yields a byte-identical
vector. **Cost scales with change.** Two carry passes: first from ACTIVE (the generation the eval
vetted, so a poisoned-but-withheld candidate cannot propagate through the stable bulk), then from the
newest complete for the remainder — measured 2026-08-02, without it one generation re-embedded 5,915
chunks while its predecessor held near-identical content.

**Deletions are implicit and free** — a node dropped from the manifest simply does not exist at N+1.
Old generations reap leaf-first (parent FK is RESTRICT), never touching the denylist or the audit log,
under an algebra that never reaps active or rollback, respects a grace window exceeding the snapshot
token TTL, and always leaves ≥2 complete generations. **Flip is monotonic** (`WHERE active_generation < %s`).
Health gate: zero pending, some embedded, and `failed/(embedded+failed) ≤ 0.02`, so one poison chunk
cannot wedge every future flip. The worker aborts the run on a retryable batch error (chunks stay
pending; resume = rerun) and **binary-splits down to the single poison chunk** on a non-transient one.

**The nightly refresh** (`scripts/refresh-sor.sh`) gates on the book SHA versus the active
`source_commit`, clones at that SHA, runs gold drift and declaration drift, publishes, ingests
**build-only with no flip**, resolves the READY candidate, runs the acceptance eval **pinned to the
candidate**, applies a pre-flip shrink guard, flips, and GCs on every exit via a trap.
**Eval-before-flip** means the candidate is measured while the old generation still serves, so a
regression never reaches a reader and there is nothing to roll back. `FORCE=1` is required for
config-only changes, because the gate compares only the book SHA.

> ⚠️ **A recorded scar worth fixing upstream.** `generation.py:348-351` records that
> `'generation_rolled_back'` was not in the `retrieval_log.action` CHECK, so the audit INSERT aborted
> the wrapping transaction and silently undid the pointer restore. **The automated rollback never
> actually rolled back.**

---

## 8. Grain, budgets, windowing

| Constant | Value | Where |
| :--- | :--- | :--- |
| `CHARS_PER_TOKEN` | 4 | `config.py:25` |
| `SEARCH_BUDGET_CHARS` | 136,000 | `service.py:40` |
| `LESSON_BUDGET_CHARS` | 280,000 | `service.py:41` |
| `MAX_SEARCH_K` | 50 | `service.py:45` |
| `MAX_QUERY_CHARS` | 2,000 | `service.py:51` |
| **instance `maximum_response_characters`** | **72,000** | `instance.md` |

The instance cap governs **both** paths (`service.py:511, 604` each `min()` against it), so both are
effectively 72,000 chars ≈ 18k estimated tokens. Lowered from 120,000 after a live field test:
120KB windows overflowed a practical agent turn — an 81KB first window spilled to a file — making the
`from_heading` paging loop unusable as designed.

**Grain expansion** (`service.py:268-323`): `passage` is the raw chunk with SVG → `[diagram]`,
greedy-packed, non-fitting hits omitted and counted into a `note`. `section` is the hit's **own**
heading subtree — with a documented bug at `:284-288`: the pre-fix code took the top-level ancestor,
so a hit at `cat/term` returned the whole category, expanding a glossary term to ~60 definitions, a
19× over-return. `lesson` is all node chunks. Larger grains dedupe by expansion target and share the
budget in rank order; a cut hit gets `truncated: true`.

**`window_lesson()`** takes greedy whole top-level sections, descends one heading level only when the
first section alone exceeds budget, falls back to whole chunks below that, always returns ≥1 chunk
(asserted), and produces a **contiguous ordinal run** so consecutive windows concatenate byte-exact.
The cursor is ordinal-precise when a window ends mid-heading — otherwise a bare heading cursor would
rewind to that heading's first chunk and **loop forever**.

Signalling: `window_from/window_to/next/remaining_outline/est_tokens/total_est_tokens` plus a `note`;
`truncated: true` on a cut hit; a `note` when hits are dropped by budget; `k_note` when `k` is clamped
(emitted **even on abstention**); `degraded_reason` on embed outage; `content_advisory` on directive
text; `snapshot: "refreshed (<reason>)"` on a stale token.

---

## 9. Tests, env, and two ideas worth stealing

28 files / ~5,992 lines in gateway + kernel, plus 6 (761) in gateway-kit and 11 (1,328) in platform.
Unit tier runs with no DB, no network and no key (`uv run --package sor-content pytest`); the DB tier
is opt-in on three files behind `SOR_DB_TESTS=1`. **No `conftest.py` anywhere in the live tree.**

- **`test_wire_surface.py`** asserts **byte-identity** of tool descriptions and param schemas against
  a frozen baseline. This is what makes the tool contract *kept* rather than merely intended.
- **`ingest/audit.py`** is a re-runnable corpus linter whose docstring records **three failed regex
  approaches** so nobody re-spends the day, and which is explicitly `NO DATABASE, BY DESIGN` — a check
  that needed Postgres would not run in CI and would catch nothing.

Environment surface (~40 vars). Required: `SOR_INSTANCE_URI` + `SOR_INSTANCE_SHA256` (the deploy
authorization), `GEMINI_API_KEY`, `SOR_SNAPSHOT_KEYS`, and the instance-named DSN. Then auth
(`SOR_SSO_URL`, `SOR_MCP_RESOURCE_URL`, `SOR_JWT_ALLOWED_AUDIENCES`, `SOR_AUTH_DISABLED`), serving
(`PORT` — **its presence flips the bind to 0.0.0.0**), pool (`SOR_READ_RETRY_BACKOFF_S` absorbs Neon
cold wake of 4–10s), caches (six TTLs; everything fail-open without Redis), embed timeouts (read
twice with different defaults, `embedding.py:32` and `query_embed.py:37`), rate limits, ingest ops
(`SOR_MAX_SHRINK` 0.15), and observability (`SENTRY_DSN` is **fail-soft** — a bad DSN must never take
the container down).

---

## 10. Three decisions to carry into the kernel unchanged

1. **The digest is the authorization.** Verified before any parse; pinned into every snapshot token so
   a token from one deployment is refused by another; recorded in `ingestion_runs` and every audit
   row; diffed at `/health` against the served generation to surface config drift. The tarball is
   byte-reproducible specifically so incidental whitespace cannot move it.
2. **Generational rebuild with eval-before-flip.** Build invisibly at N+1, carry forward by content
   hash, gate on health + model consistency + shrink + an acceptance eval pinned to the candidate,
   then flip one pointer monotonically. The failure mode becomes **staleness, never corruption**.
3. **Abstention as a calibrated, config-driven gate — with the negative results written into the
   code.** `vector_floor: null` means uncalibrated, gate off, and `/health` says so loudly. The
   keyword-floor and title-boost experiments that *failed* live beside the constants they explain. For
   a kernel aimed at four professions, that discipline — measure per corpus, record what lost — is
   worth more than any particular constant.
