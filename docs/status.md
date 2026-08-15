# Status

What is true today, what is next, what blocks it. Changes weekly — which is why it is not in
`AGENTS.md`.

*Last updated: 2026-08-15*

---

## Where it stands

**Phase 0 landed 2026-08-13, gate green on first run** (it caught its own boundary test's lint —
working as intended). Exists and runs: the uv workspace (`packages/vsor`, Python ≥3.14), the
Makefile vocabulary, CI (SHA-pinned actions, `make gate`), AST boundary guards at **baseline zero**,
`tests/fixtures/tiny/` — the book's own `/vsor` example made real: ten Pakistani-dish documents, ten gold
rows, five OOC probes (three scope-adjacent) — a docker-compose for CI (removed 2026-08-15; it returns with the ingest code), and the supply-chain cooldown
(`exclude-newer`).

**Three of the four verbs are implemented** and each has been walked live, like a user:
`vsor init` against its **ratified** spec, `vsor dev` and `vsor build` against `specs/vsor/build`.
`vsor serve` — the MCP surface and the Postgres half behind it — is the one that remains, and it
exits 2 saying so. (This paragraph read "the CLI is an honest stub · **no verb is implemented**"
until 2026-08-14, four commits and one tag after it stopped being true, in the file AGENTS.md names
as the only authority on what is built.) The kernel being extracted runs in production upstream
(SHAs in `docs/extraction.md`).

The doc set was consolidated 2026-08-12 from seven files to four after a repeatable cold-read test
returned **converging** — the earlier tarball false-mechanism is dead, both readers "mostly-clear" —
while flagging that contradictions were accumulating between files. Superseded documents live in git
history (the root commit), not the tree.

## v0 scope

**`vsor init` → markdown in a folder → both surfaces serve it, honest about what it does not know.**

- Governance **level 0 only** — no `governance/` directory, which removes `sor-governance` from v0
  entirely.
- **A real agent kit, not one skill** (AGENTS.md decision 5's revision, owner 2026-08-13): the
  scaffold writes `.claude/settings.json` (the vsor verbs pre-permitted, no hooks), the
  `.claude/rules/` that say how a governed corpus is worked, and a skill set — `add-sources` (the
  one the five-minute claim rests on) plus the corpus-generic families copied from upstream and
  de-branded: source conversion, knowledge work, the shipped content primitives, the meta pair, and
  `deploy`, the first of the five deferred vsor skills to land (2026-08-14: publishing was the one
  thing a finished build told the user nothing about; the `vercel.json` and `netlify.toml` it
  arrived with were withdrawn into the skill the same day). **Which files, and how many, is not
  stated here** — this bullet used to name all fourteen skills and count them, and a copy of a list
  is a list that drifts. The **generated** tree in AGENTS.md is the map;
  `tests/acceptance/init.sh` and `test_init.py`'s `EXPECTED_FILES` are the contract; and
  `tests/test_generated_docs.py` (2026-08-15) holds all three to each other so no reader has to.
- **De-branding is done and CI-enforced, not deferred.** Zero upstream brand strings in shipped
  source, in built bundles, or in the scaffold's prose — the last of those became a test on
  2026-08-14 (`test_surface_contract.py`'s markdown tier, which also bars curriculum vocabulary:
  the skills crossed from a curriculum repo, and a tax-law SoR must not find lesson/chapter/learner
  language in its own kit). One recorded exception: the framework's own repo URL in the scaffolded
  AGENTS.md.
  *Extended the same day, after a review found the scan's subject was too narrow on three counts:*
  the curriculum word list now runs over **shipped source** (`.ts/.tsx/.js/.css` and every shipped
  `package.json`) as well as prose — 118 lines of it were inside the wheel, one package was named
  for it, and it printed to the owner's console on every build, none of which any tier could see;
  the lineage rule (no upstream repository in what a package says about *itself*) now covers all
  ten shipped packages rather than two; and the lockfile denylist now also scans the **shipped**
  shell lockfile, which is the one a user's `npm ci` resolves and is not a subset of the workspace
  one. `@vsor/lib-chapter-manifest-plugin` became `@vsor/lib-section-manifest-plugin`, and its
  hardcoded three-level directory convention became "a section is the folder the document is in".

**Deferred, named as choices:** levels 1–4 · five of six skills · deployment targets beyond local ·
the customer-overlay mechanism (no schema support exists today — `corpus_id` is absent from all five
content tables) · brand genericization · the second vertical · migration tooling · benchmarks ·
governance process.

**Held open on purpose — decided at the keyboard, not from a document:** the build record's exact
fields (when writing `build`) ·
chunking parameters for a non-curriculum corpus (first non-book corpus) ·
whether site and ingest share one build (wiring `sor-site`) · level-0 floor behaviour (after the
experiment below).

## Prior-art study (2026-08-13) — folded in

Four frameworks were profiled in code at pinned SHAs (eve `1cd563b`, deepagents `217b9eb`, openclaw
`e45a946`, openai-agents-python `fc461ee`); full profiles and synthesis in the session scratchpad
(`study/`). Our settled decisions matched the field's convergence almost everywhere. The four
divergence flags were put to the owner and resolved:

| Flag (all four repos differ from us) | Resolution |
| :--- | :--- |
| One name for package and binary | **Adopted** — `vsor` everywhere; PyPI free; the ziavsor hedge was unnecessary |
| Fewer internal packages | **Rejected from experience** — upstream ran this domain as a monolith, paid for the split, and the split won. Package-per-domain stands; the tax is engineered out by lockstep versioning |
| Nobody gates releases on live-LLM evals | **Precondition added** — measure behavioural-eval flake rate (gold set × N runs) before wiring the gate (B3) |
| Single-language runtimes | **Stands as settled** — couple through `build.lock.json`, never lockstep releases across languages |

**Skeleton build plan additions from the study:** the scaffold is its own test suite (file-by-file
assertions including the negative ones — no `governance/`, no empty dirs); snapshot the compiled
surfaces from the first commit (`tools/list`, citation envelope, abstention text, `/health`, one
rendered page); AST boundary guards at **baseline zero**; protected wiring (serving without the
citation envelope or abstention path is a construction-time error); `vsor.testing` deterministic
doubles as public API; the eval verdict enum (gate / scored / tracked) visible in every result row;
docs in the wheel + a locator-only SKILL.md; a strict release profile where **a skip is a failure**;
one canonical command vocabulary quoted by AGENTS.md and called by CI (tool — Makefile vs raw uv —
decided at the Phase-0 keyboard; evidence splits between openai-sdk and upstream); supply-chain trio (uv cooldown, exact dev
pins, SHA-pinned actions); bounded corpus discovery copied from openclaw (file caps, symlink
containment); `add-sources` authored in the ecosystem SKILL.md format — **and every converted
document carries an origin-artifact record** (converter + version, source-bytes hash, page range,
human fidelity attestation), or an OCR error in a rate table ships with full authority.

**Never** (evidence in the study): implicit default embedder/model/floor · a vendoring pipeline ·
a guard-script zoo with debt baselines · committed generated artifacts.

**Resolved 2026-08-13 (owner):** embedding key → user-supplied via `.env` at beta 1 (Gemini;
provider pluggability post-v0), so the five-minute promise carries a stated precondition: *keys in
hand*, with the agent walking the user through getting them · docker → **never a user requirement**;
the user's database is any Postgres DSN in `.env` (Neon free tier recommended); docker is framework
dev/CI only (Test 1 is the framework path; the user path is `.env`) · deployed auth → off by default
**bound to localhost**; public bind fails closed unless a standards-compliant OAuth provider is
configured or `--allow-unauthenticated` is explicit (AGENTS.md decision 12).

**Customization-surface audit (2026-08-13), settled by evidence:** the user project gains a thin
REAL Docusaurus shell (`site/` — config, css tokens, homepage; measured reference scaffold is 364
lines) instead of an instance.md→config mapping layer; kernel machinery stays installed. Decisive
findings: the full upstream app is 112k lines with **dead decoy seams** (its `themeConfig.navbar`
and `footer` are silently ignored by full-ejection swizzles — an agent following its training data
edits config and nothing changes) and `--ifm-color-primary` never defined; the kernel has **no
training-data presence** and the canonical customization ("bias toward newer docs") is a trap in
raw source — no document date exists in the store, so the obvious SQL edit ships a silently wrong
signal; upstream itself **never forks domain source** (zia-tutor = declarative product.md + 3,194
lines of NEW composition code, zero forked kernel lines — the owner's "zia-tutor is already a
framework package" intuition, confirmed); the book's own asymmetry maps exactly (corpus served
faithfully = installed; reflexes/map derived and owned = authored files). Full audit in the
session scratchpad and the run journal.

**Node spike — resolved with live evidence (2026-08-13).** The scaffold's exact `site/` templates
build under stock `@docusaurus/preset-classic` v3.10 with **no `sidebars.ts`** (autogenerated
sidebar confirmed live), `path: ../knowledge` resolving, the `--ifm-color-primary` token present in
the shipped CSS bundle, homepage + doc page + 404 all rendering, and zero request-initiating
external references from the shell. Measured: `npm install` 72s / 267MB node_modules (one-time);
`docusaurus build` 14s (Node 24, Apple Silicon). **v0 wiring recommendation for the build spec:**
the user's `site/` stays authored-input only (the init contract's exact file list holds); `vsor
build`/`dev` materialize a runtime shell under `.vsor/` (package.json + install cache + the user's
site files), per init's all-scratch-under-`.vsor/` rule — Node presence becomes a stated
precondition like keys-in-hand, managed-runtime download is a later upgrade. Spike artifacts in the
session scratchpad (`node-spike/`).

**Still open:** version-pin mechanics (`instance.md` pins vsor; `uvx vsor` runs latest — v0 minimum:
`build.lock.json` records the version that ran and `vsor` warns on mismatch; re-exec is a later
call) · `eject` mechanics for Python (path preference, upgrade-after-eject) and the ejected
directory's name (`vendor/` leads over `lib/`; decided in the eject spec, which trips the spec
threshold).

**New unknowns for the skeleton to measure:** behavioural-eval flake rate before gating · does
docs-in-the-wheel measurably help a coding agent (run Test 2 with and without) · Test 2 driven
entirely by a coding agent, human only pasting paths · serve-time token cost of the MCP prompt
surface on `tests/fixtures/tiny/` · scaffold-upgrade story once 0.2.0 meets a 0.1.0 project (record enough
in `build.lock.json` to derive it later).

## Measured limits (2026-08-14) — the corpus-scale experiment

Everything had been proven on 3–48 documents. A system of record holds thousands, so the site
build was measured against synthetic corpora on this machine (Node 24, Apple Silicon):

| corpus | layout | build | output | per doc-page HTML |
| ---: | :--- | ---: | ---: | ---: |
| 100 | flat | 25s | 12 MB | 120 KB |
| 500 | flat | 33s | 74 MB | 148 KB |
| 2,000 | flat | 231s | 806 MB | 378 KB |
| 2,000 | 20 folders × 100 | 109s | 155 MB | 47 KB |

**Output size is quadratic in a FLAT corpus.** Docusaurus bakes the whole sidebar into every page,
so 2,000 flat documents put 2,000 `<li>` entries on each of 2,000 pages — 742 MB of the 806 MB is
`docs/`. Collapsed folder categories emit only their own section (120 entries), which is why the
same 2,000 documents cost 155 MB and half the build time. **Folder structure is not cosmetic in
this framework; it is the difference between O(n²) and O(n·k).** The scaffold ships a flat
`knowledge/` and, until this was measured, said nothing about it.

Second-order: `search-index.json` is 34 MB at 2,000 documents and the browser fetches it on first
search — fine at hundreds, not at thousands. That paragraph named "a server-side search" as the
post-v0 answer; it was measured the next day instead, and the answer is below.

**Working guidance until the machinery changes:** comfortable to ~500 documents in any layout;
past that, organize `knowledge/` into folders. A build-time warning enforces the advice rather
than leaving it in a document nobody reads.

## Search at scale — measured, and decided static (2026-08-15)

"Server-side" deletes the property `tests/acceptance/deploy.sh` exists to protect — plain static
files, no server, any host — and `specs/sor-site/surface` pins it in one line ("Search stays the
local index — no external service"). So it was measured before it was inherited. Corpora were
regenerated and deleted (Node 24.18, Docusaurus 3.10.2, `@easyops-cn/docusaurus-search-local`
0.55.3, mermaid off, 100 documents per folder, ~3.3 KB of markdown each) and the **shipped**
SearchBar was driven in a real Chromium against a gzip-serving loopback host.

| documents | `knowledge/` | build | site | `search-index.json` | over the wire | keystroke → first result | repeat query |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 0.33 MB | 14s | 9 MB | 1.90 MB | 0.48 MB | 0.8 s | 0.8 s |
| 500 | 1.68 MB | 23s | 37 MB | 9.36 MB | 2.32 MB | 1.4 s | 0.8 s |
| 2,000 | 6.72 MB | 175s | 150 MB | 37.67 MB | 9.27 MB | 3.5 s | 1.9 s |

The last two columns are end-to-end through the shipped dialog and carry a 300 ms debounce plus
~0.3–0.5 s of harness overhead, so read the *differences*. Measured inside the page instead, with
no harness in the way: fetch-and-decompress 109 / 566 / 2,058 ms, `JSON.parse` 15 / 68 / 321 ms,
one query 29 / 51 / 266 ms. **The 2 s at 2,000 documents is not bandwidth** — that is a loopback
host; it is gunzip turning 9.27 MB back into 37.67. A 25 Mbit connection adds ~3 s on top.

Three facts the earlier note did not have.

**The index is linear in corpus BYTES, not in documents** — 5.6× the markdown at every size
measured (5.70 / 5.57 / 5.60), and 1.4× over the wire. The ceiling is therefore the weight of
`knowledge/`, not a document count: 500 statutes cost what 2,000 short records do, and a build can
predict the index before Docusaurus writes one.

**87% of the index is body text.** At 2,000 documents the content sub-index is 32.9 MB of the
37.67; headings 2.5, descriptions 1.7, titles 0.6. Anything that shrinks the index while keeping
full-text search is negotiating over the other 13%.

**The repeat query is our defect, not the index's.** `search-utils.ts` memoises the parsed JSON but
not the deserialized lunr indexes, and resolves every hit with a linear `documents.find()` over all
9,902 index rows. Searching a *common* term at 2,000 documents (7,126 hits) measured 1,935 ms, of
which 1,841 ms was that scan — paid on every search, not the first.

### What the plugin already offers, and what each costs

| option | what it does | what it costs here |
| :--- | :--- | :--- |
| `searchContextByPaths` | the only real size lever: one `search-index-<path>.json` per named path | **built and measured**: over the 500-document corpus's five folders it emitted five ~1.9 MB shards and left the root `search-index.json` at **601 bytes** — the shipped SearchBar fetches exactly that fixed path, and rendered "No results found" for a term that is in the corpus. Real sharding, but a silent break of B13 until `search-utils.ts` learns to pick the shard from the route; and search then means "this section", or it fetches every shard and saves nothing |
| `hashed` | `"filename"` → a hashed filename; `true`/`"query"` → the same filename plus `?_=<hash>` | no size change, only cache-busting; `false` is load-bearing because the SearchBar reads a fixed path, and `"query"` would keep the path but not the query, buying staleness |
| `indexDocs` / `indexBlog` / `indexPages` | whole content types on or off | blog and pages are already off; docs **is** the corpus, so off is not a smaller search, it is no search |
| `language` | lunr-languages stemmers | `["en"]` is the floor; each added language grows bundle and index |
| `removeDefaultStopWordFilter`, `removeDefaultStemmer` | index stop words / skip stemming | both **grow** the index — they exist to make matching more literal |
| `ignoreFiles`, `ignoreCssSelectors` | drop routes or page regions from indexing | real, but corpus-specific; no generic default to claim |
| `searchResultLimits`, `searchResultContextMaxLength`, `explicitSearchResultPath` | how results are presented | no effect on index size |

There is no lazy, incremental or streaming index in this plugin: its own SearchBar fetches on first
focus, ours on first query, and both fetch the whole file.

### The decision

**Keep the site static and state the browser index's ceiling: ~500 documents — more exactly, keep
`search-index.json` under ~10 MB, which is ~1.8 MB of markdown in `knowledge/`.** Below it a first
search settles in about a second and a repeat search is imperceptible, the build stays a directory
of files any host serves, and nothing built on top has to assume a process.

What that costs, plainly: a project past the ceiling still builds and still publishes every
document — only its in-page search bar degrades, and the framework says so rather than letting an
owner discover it at 9.27 MB. It is **not** "don't hold thousands": the retrieval path for a large
corpus is the MCP surface (`vsor serve` — `outline`, `read`, `search`, with Postgres behind it),
which is v0 scope and the one verb still unimplemented. The site's search bar is a reader's
convenience over the same corpus, never the system of record's index.

**When it stops being the right answer:** at about double — ~3.5 MB of markdown, ~20 MB of index,
~5 MB over the wire, first search past 2 s. Past there a stated ceiling is not guidance, it is a
broken feature, and the move is sharding rather than a server: the folder layout the build already
insists on at 300 documents is exactly the shard key `searchContextByPaths` wants, and the work is
in `search-utils.ts` (choose the shard from the route), not in the hosting story.

**Named, not built, in this run:** a sibling to `build_cmd.py:_warn_flat_corpus` that predicts the
index from `knowledge/` bytes × 5.6 and says the number before Docusaurus writes it; and caching
the deserialized lunr indexes beside the parsed JSON in `search-utils.ts`, with `documents` keyed
by id instead of scanned — worth ~1.8 s per common-term query at 2,000 documents, and independent
of every option above.

## Found by the hosting acceptance (2026-08-14) — three defects, all closed

`tests/acceptance/deploy.sh` (`make deploy-acceptance`) builds a scaffolded project with a real
`vsor build` twice — once for a root host, once for a subpath host — and serves each in the shape
its host would have. Its first honest run was **red on three defects, all real, none visible to any
other tier**: `make surface` builds an *assembled* fixture rather than the shipped output, and it
only ever serves at `/`. Each was fixed in the product, not in the test; the target has been green
since 2026-08-14 (23 passed, 1 skipped — D9 has no meaning in the root shape).

| Defect | Fix, and how it was measured | Where |
| :--- | :--- | :--- |
| **The first sidebar link was unclickable** — `document.elementFromPoint` at the first document's centre returned the navbar. Docusaurus tucks the container under the navbar (`margin-top: calc(-1 * navbar-height)`) and pays it back with `padding-top` on the inner `.sidebar_*`; this file deleted that padding and compensated with `position: sticky; top: navbar-height` on the viewport instead. **That substitution is conditional and the original was not:** sticky only honours `top` while it has slack inside its container, and the viewport's `height: calc(100vh - navbar)` equals the container's height on any page no taller than the window. So the compensation worked on long pages and silently did nothing on short ones. Fixed by cancelling the negative margin — one compensation, unconditional. Measured on a real build at 1280x900: before, aside top 1px / first link y=21..57 / elementFromPoint returns the navbar; after, aside top 65px / first link y=85 / elementFromPoint returns the link. Identical at 1280x400, where the page scrolls; restoring the padding instead measured y=148 there, a 64px gap, because both compensations then apply. | D4 + D7, both shapes | `packages/sor-site/app/src/css/sidebar.css` |
| **The favicon head tag ignored the project's `baseUrl`** — `headTags` composed `href` from the shell's own `BASE_URL` constant rather than the merged config, so every GitHub Pages project site shipped `<link rel=icon href="/img/favicon.svg">` pointing above its own site, while the theme's react-helmet icon link (which does read the merged value) was correct: the two disagreed inside one `<head>`. Fixed by a post-merge backfill, `followBaseUrl()`, narrow in the same way `followTitle()` is — it rewrites only the shell's own untouched tag. | S2 + D8, subpath shape | `packages/sor-site/app/docusaurus.config.ts` |
| **The sitemap's ignore pattern was `baseUrl`-naive** — a route path carries `baseUrl`, so the absolute `/search` stopped matching `/repo/search` and a subpath deploy advertised its search page to crawlers while a root deploy did not. Rebased by the same backfill; the relative `**/tags/**` is left alone because it is already correct in both shapes. | the driver's cross-shape route-set row | `packages/sor-site/app/docusaurus.config.ts` |

**Two more the same run found, in the same class — right in a browser, wrong for machines, under a
green build tick.** The shipped structured-data plugin extracted `<meta name=description>` and
`<link rel=canonical>` with quotes-required regexes while Docusaurus's production minifier emits
both unquoted, so every doc page's Article node carried the site tagline as its description and
dropped `mainEntityOfPage` entirely; and every id and url in the graph was built from
`siteConfig.url` with no `baseUrl` join, so a subpath site announced its identity and its search
endpoint at the origin root. Both fixed in `packages/sor-site/lib/plugin-structured-data/index.js`,
and both are now a row — **S3**, which runs in both shapes and asserts that the two documents carry
*different* descriptions, because one value across every page is exactly what a failed extraction
looks like.

Measured wall clock (Node 22.15, Apple Silicon, warm npm cache): `deploy-acceptance` 2m56s
including its own `make wheel` — against `surface` 4m34s and `build-acceptance` 4m13s. It stages
the same shared paths those targets stage, so it is a separate target rather than a link in that
chain, and the three cannot run concurrently on one checkout.

## The record audit (2026-08-15) — what the record was lying about, and what it now is

The last review before publishing attacked `build.lock.json` itself, on the premise that every MCP
citation slice 2 returns resolves through that file. Eleven defects, all measured on real builds
with the real wheel, all closed here; the record moved to **format 2** in the same change, which is
the last moment it is free (a format bump after a PyPI release is a migration).

| What the record said | Why it was false | Now |
| :--- | :--- | :--- |
| `corpus.git` + `documents[]` | Below the repo root — the layout `vsor init` **instructs** the user into, inside an existing work tree — the rows are project-relative and the commit is the enclosing repository's, so `<sha>:knowledge/x.md` is a path no commit contains. Nothing carried the prefix. | `corpus.prefix` (`""` at the root, `"sor/"` below it); `<git>:<prefix><path>` is asserted to resolve, per document, in `tests/acceptance/build.sh` |
| `corpus.git` with a linked corpus root | `ln -s ~/docs knowledge` is deliberately legal (site and record agree). HEAD then holds a 120000 symlink blob: zero recorded documents fetchable from the commit the record named. | null, with a warning naming the link and the field |
| `corpus.git` with a dirty `site/` or `instance.md` | The clean-check covered `knowledge/` while `build_id` covers seven inputs. Editing `site/docusaurus.config.ts` — the documented customization surface — left a record naming a commit that reproduces a *different* `build_id`. | HEAD only when `knowledge/`, `site/` **and** `instance.md` are all clean against it |
| `build_id` | Blind to the forked site application (unpacked, not installed — no npm integrity hash covers it) and to six `VSOR_*` environment variables the shell config reads. Two builds with the same `build_id` published at different origins, with different canonical links, og: URLs, JSON-LD `@id` and sitemap. | `site.app` joins the preimage; `runtime_env` strips every `VSOR_*` key, so the config file is the only door |
| `documents[]` rows | A `draft: true` document is hashed, moves `build_id`, gets a row — and Docusaurus emits no route for it. A citation resolves to the record and 404s. | refused at build time, `error: knowledge-invalid` |
| nothing at all in `build/` | The artifact carried no identity and the record named no artifact, so deploying last week's `build/` beside this week's committed record was undetectable by anything. | `build/build.lock.json`, written into staging before the swap — byte-identical to the committed one |

Four more in the same run were **safety**, not honesty, and are closed beside them: a `build/` that
is not a directory half-completed the swap and then wedged every later run; `vsor dev` ignored
SIGHUP, so a closed terminal orphaned a live server while releasing the lock; `superseded: yes`
passed PyYAML as a boolean and reached the page as a string, rendering no notice at all; and
frontmatter that PyYAML rejects while gray-matter accepts turned the whole effective-dating gate off
for that document, silently.

**Negative results — the attacks that did NOT break the record.** Recorded so the next adversarial
pass starts where this one stopped rather than re-spending its budget:

- writing into `knowledge/` at t=2s, t=8s and t=14s of a running build reaches neither `build/` nor
  the record, in both directions (a delete after the snapshot is likewise built and recorded) — the
  shell-snapshot fix holds;
- a gitignored document warns, names the file, and nulls `corpus.git`, with the document present in
  `build/` — correct;
- a symlink **inside** the trees is refused before any install (`error: symlink-unsupported`);
- the record write failing at the exact syscall stages a temp, fsyncs, renames, unlinks on failure,
  never truncates the previous record, exits 3, and says what is still true;
- `build_id` stability: a byte-identical rebuild reproduces it exactly; `created` varies alone;
  touching one document moves it and moves only that document's row;
- `.vsor/lock` prevents the two-verb shell corruption, and `_recover_interrupted_swap` handles both
  crash points between the renames.

**One limitation found while closing these, recorded rather than fixed.** `documents[]` paths are
NFC-normalized (deliberately — it is what makes one corpus hash the same on macOS and Linux) while
git stores the filesystem's own bytes, which on macOS are often NFD. So `<git>:<prefix><path>`
resolves for every ASCII or NFC-named document and needs a normalization pass on the consumer side
for a decomposed filename. The prefix itself is left exactly as git reports it, for the same reason
— it addresses git objects, not the walk. This belongs with slice 2's citation resolver, which is
the first code that will actually fetch through the pair; changing the walk's normalization to suit
it would trade a cross-platform property for a single-platform one.

One finding was **rejected as spec-compliant** and queued as wording instead: `corpus.documents[]`
includes every regular file under `knowledge/**`, a `.txt` among them, which the spec defines
exactly that way while AGENTS.md calls the record "one row per document". The vocabulary disagrees;
the code does not. Splitting `corpus.tree` (all files) from `documents[]` (published rows) is a
second record change and belongs with slice 2's citation shape, not in the same week as format 2.

## Ship order — two slices (decided 2026-08-13)

**Slice 1 — the site surface.** `learn-app` extraction → `sor-site`; `vsor init` + `vsor build`
producing a branded website from `knowledge/` + `instance.md`. Needs **no database, no keys** —
shippable and demoable alone. Owns the two questions that belong at the keyboard: **Node at build
time** (model C promises the user never installs Node — candidate answers: a managed runtime the way
Playwright manages browsers, a prebuilt site shell in the wheel, or graceful skip) and the first
**`vsor eject site`** target. Earns the acceptance line "the site builds and the corpus is
browsable".

**Slice 2 — the MCP surface.** `sor-content` + `sor-platform` + `sor-gateway-kit` → `vsor serve`:
Postgres, embeddings, retrieval, abstention, on plumbing slice 1 proved. Earns the rest of Test 1
and all of Test 2.

## The task in flight

`vsor/init` is **ratified** — the first ratified contract (exact-floor pin, native `site/src/`
layout). `vsor/instance-format` drafted. `sor-site/surface` **drafted, then hardened by adversarial
self-review** (2026-08-13; three hostile lenses, 28 findings — the worst: the original acceptance
was all static scans, so the audited upstream defects — dead-decoy `themeConfig`, decorative tokens,
the shipped homepage-404 — would have passed green CI). Now: negative contract closed (no ellipsis;
closure rule kept ∪ excluded = surveyed set; GA4/analytics and the `data-brand` switch excluded,
extraction.md corrected), dependency **allowlist** not denylist, and a deterministic **Playwright
browser tier as the enforcement of record** — runtime network interception proves "the theme phones
no one", sentinel rebuilds prove every documented seam is live, primitives are clicked, search is
run. Two scope decisions the review made, flagged for the ratification read: **i18n deferred
wholesale post-v0**, and **the MDX vocabulary (`<Quiz />` etc.) ships from slice 1** as a small
package **extracted from learn-app** (owner decision 2026-08-13 superseded the review's fresh-author proposal: copy authorization granted for learn-app — copy, strip, rework) so the
theme upgrade literally changes look, never contract.

**`sor-site` landed 2026-08-13 — the extraction is real.** `packages/sor-site/` (npm workspace,
lockfile committed): `@vsor/sor-site-app` (the runtime shell — the whole forked Docusaurus site:
the MDX vocabulary of Quiz, flashcards, gallery, ExerciseCard, HighlightTip and ImageZoom through
its own `@theme/MDXComponents`, AND the design system — Tailwind v4 + shadcn/ui primitives + an
OKLCH token layer bridged onto the `--ifm-*` variables + lucide — AND the chrome it paints: **full
swizzles** of Navbar, Footer and Landing, plus LessonContent, DocPageActions audited to four
corpus-neutral actions, ReadingProgress, SearchBar and ModeToggle), and ten `@vsor/lib-*`
content-pipeline packages
with the five tab plugins collapsed into one `remark-tabs` before crossing the seam — all copied
from `ag2` at the pinned survey SHA under the owner's copy authorization, stripped per the surface
spec's exclusion contract, de-branded (CI-scanned).
*Amended 2026-08-14, twice.* First: the extraction's first pass shipped bespoke CSS and the owner
rejected it as "simple Docusaurus, not specialized", so the design system crosses whole — which is
what makes B12 seam liveness load-bearing rather than theoretical. Then: the extraction shipped as
two installable packages, `@vsor/sor-site-mdx` and `@vsor/sor-site-theme`, and the fork superseded
both. The shell manifest referenced neither, so they reached no user while still reading like the
place to edit a Navbar; **both were deleted** (63 source files) and Phase A's two remaining
pointers at them — A3's designated token file, A4's frozen prop baseline — were repointed at
`app/src` in the same change. Phase A runs inside `make gate` (allowlist +
denylist backstop, exclusion boundary scan from the one committed `exclusions.json`, token lint at
baseline zero, prop baseline); the browser tier is `make surface` (B5–B13,
B15, B16, B17; B14 retired 2026-08-14 — and B17, effective dating, is numbered in code with its
spec wording queued) against one configuration built twice, normally and with B12's
sentinels. The live walk caught what suites alone would have shipped:
React #418 hydration on every themed doc page for Mac readers (Node ≥21's global `navigator` made
the SSR guard dead), the build host's OS baked into shipped HTML, clipboard junk in
Copy-as-Markdown — all fixed with red-state evidence and found-live comments.
**The named follow-up closed 2026-08-14:** the per-primitive render assertions (flashcards,
gallery, ExerciseCard, HighlightTip, ImageZoom, tabs, mermaid) landed with the fixture doc that
exercises them — `tests/fixtures/tiny/document-primitives.md` plus its co-located flashcard and gallery
YAML — taking the browser tier from 21 checks to 28. Each asserts computed-style *floors* (a rule
width, a padding, a hairline) rather than equalities, so a stripped box fails while decoration
stays free to change. A 29th followed in the green pass: the hero's uppercase had shipped as a
recorded `found live` with no assertion, so it now has one. Still open: the search title-ranking
niggle, recorded beside the code.

**The design-system pass, 2026-08-14 — what the browser found that CI could not.** Bringing
Tailwind across whole introduced a failure the entire B-suite stayed green through: Docusaurus's
postcss-preset-env polyfills `@layer` into `:not(#\#)` specificity hacks, which raised Tailwind's
**preflight** to (0,2,0) — above every single-class CSS-module rule in the corpus's own primitives.
Measured on the identical class: quiz options 773x54 with a 1px border and 12px/16px padding on
stock, 800x28 with neither on themed; the search dialog jammed against the top edge of the window;
Docusaurus's own `clean-btn` stripped. The design system was silently un-styling the primitives it
was brought across to dress. Fixed by not shipping preflight (theme + utilities only) and naming
the three things it was doing for this package on the components that need them; the browserslist
"fix" was measured and **rejected** — with real layers the utilities lose to Infima and the hero's
call to action renders a teal label on a teal button. Also found live and fixed: code blocks were
pale-on-pale in light mode (the theme forces a light code surface, Docusaurus's default Prism theme
is dark — the scaffold now sets `prism`), `--info`/`--warning` were never in the token layer so
three of five admonition kinds were indistinguishable, the breadcrumb's designed "/" never rendered
behind Infima's chevron, the mobile sheet's search control was a bare unlabelled magnifier, the
search box was the one piece of chrome off the token set, and a new site's footer was a 214px band
of nothing. B15 is the net: it asserts a CSS-module primitive keeps its own box, and that fenced
code clears 4.5:1 in light mode — the two assertions that would have caught this. (It read "in both
builds" while stock was the live control; with one configuration the control moved inside the build
— see the B14/B15 note above.)

**CI is red for a non-code reason:** GitHub Actions reports "account payments have failed or your
spending limit needs to be increased" — jobs never start. Owner action; local `make gate`,
`make surface` and `make deploy-acceptance` are the same checks and are green. A third job,
`hosting`, was added 2026-08-14 and has therefore also never started.

**0.1.0 tagged (2026-08-14) — the site half ships.** `vsor init` → markdown → `vsor dev` →
`vsor build` → a deployable site, with `serve` still honestly exiting 2. See `CHANGELOG.md`.
Not published: `vsor` is unclaimed on PyPI, so the release is a tag and a wheel.

## Publishability (2026-08-14) — what the base needed, and what is left

The owner asked for the current thing to be made publishable and for a straight answer to "how does
a user deploy this?". Both were answered by finding out that the answer was missing: nothing in the
product said a word about deploying beyond the build's own "serve it from any static host", and the
scaffold shipped `url: "http://localhost:3000"` with no warning anywhere, so a build uploaded as-is
publishes a sitemap pointing at the author's laptop.

**Closed in this pass:** the placeholder warning · the deploy skill (it briefly scaffolded
`vercel.json` and `netlify.toml`; both were withdrawn into the skill the same day, on the owner's
challenge) · the hosting acceptance and its three defects (above) · the two structured-data
defects · `vsor init --help` · the `serve` refusal's unreal paths · per-verb CLI help · `NOTICE`
and a licence file inside every shipped npm tarball · `SECURITY.md`, `CONTRIBUTING.md`,
`CODE_OF_CONDUCT.md` · the npm-audit summary answered with an owned line and a dated review ·
`docs/extraction.md`'s contradiction with the shipped artifact · a `hosting` CI job and the same
tier on the release path, against the wheel about to be uploaded.

**Still required before `uv publish`, and none of it is code:**

| Blocker | Why it blocks | Whose |
| :--- | :--- | :--- |
| **The GitHub repository is private.** It is the wheel METADATA's Homepage, Repository, Changelog and Issues links — four dead links on the PyPI page the moment it is published. Verified: `curl` → 404, `gh api … --jq .visibility` → `private` | Publishing four 404s as a package's canonical links | owner: make it public, or strike the URLs from `pyproject.toml` |
| **The PyPI name is unclaimed** | `uv publish` has nothing to publish to; Trusted Publishing needs the project to exist first | owner |
| **A Trusted Publisher entry** for `release.yml` on this repository | `release.yml` mints its token from OIDC and stores no API token, by design | owner |
| **`release.yml` has never run** — no job in this repository has ever started (the billing state above) | A first run is still a first run. Every step has been walked by hand; the workflow itself has not | owner (billing), then watched |

The deploy story itself no longer depends on any of them: the host-command table, the two
`url`/`baseUrl` shapes and the verification recipe all ship inside the wheel — in
`packages/vsor/README.md` (which is the PyPI page) and in `.agents/skills/deploy/SKILL.md` (which
lands in every scaffolded project and works offline).

**The website surface is now a FORK of learn-app, not an extraction (2026-08-14, owner decision).**
Shown the extracted build the owner said: "why not full copy… we lose all value like this." They
were right — upstream's styling is 5,733 lines and the extraction had carried 1,836; much of that
68% was polish, not product. `packages/sor-site/app/` is the forked app (1,498 files copied → 68
kept, 82.5k → 12.2k lines of src, 57 → 30 runtime deps), and it is the shell `vsor build`
materializes. Fidelity is measured, not asserted: paragraph rhythm, search field, mobile type scale
and fonts now match the AF build's computed values. The `mdx` and `theme` packages it supersedes
were **deleted 2026-08-14** (the lead's consolidation call, taken): 63 source files, diffed
one-by-one against the fork first — 34 byte-identical, the rest either import-alias rewrites or
places the fork was already ahead. Three fixes lived only in the old copies and were moved across
before the delete; the theme-only preflight and `tailwind.css` fixes were verified *inapplicable*
to the fork (it imports Tailwind whole and runs Lightning CSS via `future.faster`, so the
polyfilled-`@layer` pipeline those fixes existed for is gone) rather than assumed so.

**Found live on real content, all fixed and guarded:** Docusaurus 3 requires `:::tip[Title]` and
silently renders the v2 form `:::tip Title` as literal text — the shell now migrates it in
`markdown.preprocessor`, since importing existing markdown is the promise (upstream's own corpus
has 429 of them); the scaffold shipped no `sidebars.ts`, so an imported corpus referencing
`tutorialSidebar` failed to build; Tailwind's preflight was un-styling the primitives the design
system exists to dress.

**Fixtures retired the dish corpus** for three pages on this framework's own subject — and they are
deliberately free of the words the brand and exclusion scans reserve, because those scans cannot
tell corpus prose from machinery. Demos use real content; fixtures stay boring on purpose.

**The AF design system landed whole (2026-08-14).** Tailwind v4 + shadcn/ui + OKLCH tokens +
lucide crossed the seam intact rather than being re-implemented — the owner rejected the first
stripped build as "simple Docusaurus, not specialized", and the root cause was pass 1 substituting
bespoke CSS for a design system. Also across: the chrome (navbar with its mobile sheet, footer,
layout, root), the doc-page and sidebar polish, and the landing-page pattern as a content-driven
primitive. *Superseded 2026-08-14 by the fork:* this paragraph read "the theme is **on by default**;
stock preset-classic is a tested fallback (B14), and a new **B15** tier proves the design system is
live in the themed build and provably absent from the stock one". There is no stock configuration
any more — `themes` is a shell-owned key a project cannot set — so B14 was retired and B15's
control became an *unscanned* utility (`gap-[13px]`) that must compute to nothing, which is the
claim the stock half was standing in for. Two live scars are recorded in the code: Tailwind's
preflight, boosted above CSS modules by Docusaurus's `@layer` polyfill, was silently un-styling the
very primitives the theme exists to dress; and an unset `prism` key renders every fenced block at
~1.3:1 in light mode.

**Proved on real content (2026-08-14).** `vsor init` → 48 real Agent Factory documents →
`vsor build` → a served site: 117 corpus files, a real `build.lock.json`, quizzes and flashcards
from the source corpus, zero external requests. Two findings the ten-file fixture could never
surface: (1) the scaffold shipped no `sidebars.ts`, so the autogenerated sidebar was named
`defaultSidebar` while every `create-docusaurus` site names it `tutorialSidebar` — **any corpus
imported from an existing Docusaurus site failed the build**; fixed in the scaffold. (2) Upstream's
own corpus is entangled with its product components (`<ProjectCard>` ×65, `<AICheck>` ×31,
`<SimPlayer>` ×8), so 33 of its 81 docs cannot build on a vsor site by design — the 48 knowledge
documents use only the shipped vocabulary. Also observed: relative paths that escape `knowledge/`
resolve inside the runtime shell, so corpus images belong beside their documents or in
`site/static/` referenced absolutely.

**Named gaps, not silently carried:** flashcards, gallery, ExerciseCard, HighlightTip and ImageZoom
still have no render assertion anywhere; no fixture contains an admonition; a one-word project name
puts the whole hero title in the brand colour.

Implementation discipline is now a skill — `.agents/skills/implement-spec/SKILL.md` (breakdown per
aspect, red-first, aggressive review, live/browser verification, detail pass, truth sweep);
AGENTS.md points to it. **`vsor init` is implemented against its ratified spec** (2026-08-13,
red-first: templates as canonical bytes, `vsor.scaffold`, the cli intercept, 47 unit tests plus the
committed acceptance harness — `make gate` green with the acceptance running offline).
**`vsor dev` and `vsor build` are implemented against specs/vsor/build** (2026-08-13, red-first:
`vsor/instance.py` · `lock.py` (+ the committed record schema) · `site_runtime.py` · `build_cmd.py` ·
`dev_cmd.py`; the wheel ships the site runtime under `vsor/_site_runtime/`; `make wheel` stages it;
`tests/acceptance/build.sh` drives the real wheel end to end in the node lane). The corpus-identity
question resolved into the record contract: the filesystem is hashed, `corpus.git` is HEAD only when
HEAD's `knowledge/` tree matches (else null) — `git rev-parse HEAD:knowledge` was rejected because a
dirty tree would make the record lie. **Found live, spec amendment pending:** the symlinked-siteDir
experiment failed both ways (Docusaurus realpaths siteDir at every command entry; webpack realpaths
`.md` resources out of the docs rule's include, dropping the doc metadata export) — the recorded
fallback, copy-on-invoke of `site/` + `knowledge/` into `.vsor/site-runtime/` with a poll-mirror
during `dev`, is what runs; the build spec's symlink paragraph awaits its amendment.

## The v0 spec map and build order (2026-08-13)

Seven specs, derived from the spec threshold (public surface · cross-package · hard to reverse ·
agent-built): `vsor/init` · `vsor/instance-format` · `vsor/build-lock` · `sor-site/surface` ·
`vsor/add-sources` (slice 1) · `vsor/serve` · `vsor/eject` (slice 2). One page each: business claim
→ observable contract → acceptance test → out-of-scope. Extraction needs no spec —
`docs/extraction.md` is that work list.

Order: **Phase 0** (workspace, Makefile, CI shell, boundary tests at baseline zero, `tests/fixtures/tiny`
— no spec, nothing blocks it) → **slice 1** (specs 1–2 → Node spike → spec 4 → init/dev/build-site
→ specs 3, 5 → timed site acceptance) → **slice 2** (kernel extraction → spec 6 → serve → gold set
+ abstention experiment → spec 7 → Tests 1+2 → checklist → quiet 0.1.0).

**Decoupling that changes the blocker math:** slice 1 ships on the **stock Docusaurus classic
theme** — the `learn-app` theme extraction becomes an upgrade, not a prerequisite. Therefore: Phase
0 and all of slice 1 are blocked by **nothing**; copy authorization gates only slice 2's kernel
extraction (+ the theme upgrade); the PyPI claim gates only the final publish.

## The two acceptance tests

They measure different things; conflating them was a past defect.

**Test 1 — skeleton (proves the plumbing):**

```bash
docker compose up -d                     # postgres + pgvector (the compose file returns with the
                                         #   ingest code; removed from the root 2026-08-15)
uvx vsor init demo                    # scaffolds, git init, installs
cd demo && vsor build && vsor serve

curl -s localhost:8080/health | jq .     # 200; abstain gate reported as uncalibrated
# MCP tools/list returns exactly: outline, read, search
# a search for a phrase in the corpus returns a hit with a provenance block
# the site builds and the corpus is browsable
# build.lock.json exists and is committed
```

Corpus: `tests/fixtures/tiny/` — ~10 markdown files with frontmatter.

**Test 2 — five minutes (proves the product claim):** from a real PDF, through a real agent, using
`add-sources`, timed. `init` → "pull in these PDFs" → "put it live" → a cited answer, and an honest
refusal for something the PDFs do not cover. **Under 5 minutes wall clock, or the finding is the
deliverable** — record where the time went.

**The first experiment:** can a usable abstention floor be derived from a ten-file corpus? The
production floor took 416 gold queries + 38 probes. Level 0 ships with the gate off and `/health`
saying so; if a floor is underivable at small scale, the honest default may become a conservative
fixed floor plus an *uncalibrated* badge. Recording this result is a v0 deliverable.

**v0 gold set:** ~10 in-corpus questions + 5 out-of-corpus probes against `tests/fixtures/tiny/`, row
schema `{q, expect, source, kind}` (+ optional `also_ok`). Probes must include scope-adjacent
near-misses.

## Shippable checklist

- [ ] Installable from a registry with a pinnable version
- [ ] README in the proven order (one sentence → tree → quickstart → complete example → docs →
      support → licence → stability statement)
- [ ] Docs shipped inside the package (offline ground truth for agents)
- [ ] Scaffold runs on the very next command with zero edits
- [ ] CI green: lint · typecheck · unit · boundary · smoke · scaffold-builds
- [x] LICENSE · NOTICE · CONTRIBUTING · CODE_OF_CONDUCT · **SECURITY.md as a normative triage
      boundary** — all landed 2026-08-14. SECURITY.md carries the operator trust model, an itemized
      out-of-scope list, and the two pre-answered patterns this scaffold will attract (the
      `curl … | sh` in the deploy skill's host-build blocks, and the floating `uvx vsor` that
      `build.lock.json` records). **THREAT_MODEL.md is still open** and stays open: it is for the
      write door and the MCP surface, and neither exists in this release
- [x] CHANGELOG with breaking changes in prose, from release one — the scaffold's file-list change
      is recorded under 0.1.1 as breaking, because the file list is a contract. The before-and-after
      numbers live in `CHANGELOG.md` and nowhere else; this line used to carry its own pair, and
      they were wrong in both halves
- [ ] Publish **0.1.0 quietly**; let usage move the number; announce at whatever it reaches. State
      the 0.x contract (minor may break, patch does not) and a 1.0 *condition*, not a date

## Open decisions

| # | Decision | Recommendation |
| :--- | :--- | :--- |
| B1 | Rights vocabulary | `rights_basis` references an executed agreement with enumerated `permitted_uses` + `serving_mode`; implement locator-only serving early, while it is one predicate. Ladder level 1 |
| B2 | Approval unit | A row keyed on `(source_id, content_hash, approver, date, scope)` — an edit un-approves exactly what it touched. `content_nodes.status` already filters every read. Level 4 |
| B3 | What gates a flip | Behavioural evals gate; relevance reports; correctness ratchets. Degraded path fails closed. **Precondition: measure behavioural-eval flake rate before wiring the gate** — no studied framework gates on live models |
| B4 | Identity & visibility | **A correctness defect, not a preference**: only the MCP surface has an access model, so private content would compile to a public site. OIDC discovery; a `visibility` key per collection; compiler refuses public surfaces for non-public content. Must be decided before any public surface ships |
| B5 | Migration policy | The deployed artifact is the build, not the repo; unknown keys warn within a major; composition reads `schema_meta` and fails closed with a named remedy |

## Blocked on the repo owner

| Question | Blocks |
| :--- | :--- |
| **May code be copied from the two source repos?** **Half-resolved 2026-08-13:** the owner granted copy authorization for `ag2/apps/learn-app` in their own words ("copy and then rework" — and rejected fresh-authored lookalikes), so the JS-side extraction into `sor-site` is unblocked: copy → strip per the surface spec's exclusion contract → de-brand. Still pending in writing: the Python kernel (`sor-agentfactory/packages/*`) — no LICENSE there, absent from the relicensing formality. Until stated: read and cite the Python side, **do not copy it**. | slice 2's kernel extraction only |
| Questions needing people outside the room: the persona licence instrument (counsel + the expert) · EU AI Act Annex III classification (counsel) · AICPA independence exposure (accounting counsel) · rights-holder serving terms (the rights-holders) · the expert's sustainable review burden (the expert). | levels 1–4, the identity pack, the moat vertical |

*Resolved earlier: CLI language (Python, `uvx`) · dev database (docker pgvector) · what `build`
emits (`AGENTS.md` settled decision 8 — the tarball forensics that settled it are in git history) ·
the first commit and push (2026-08-13; history and remote exist, supersession is now enforceable).*
