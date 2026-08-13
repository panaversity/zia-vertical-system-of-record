# Status

What is true today, what is next, what blocks it. Changes weekly — which is why it is not in
`AGENTS.md`.

*Last updated: 2026-08-13*

---

## Where it stands

**Phase 0 landed 2026-08-13, gate green on first run** (it caught its own boundary test's lint —
working as intended). Exists and runs: the uv workspace (`packages/vsor`, Python ≥3.14), the
Makefile vocabulary, CI (SHA-pinned actions, `make gate`), AST boundary guards at **baseline zero**,
`fixtures/tiny/` — the book's own `/vsor` example made real: ten Pakistani-dish documents, ten gold
rows, five OOC probes (three scope-adjacent) — docker-compose for CI, and the supply-chain cooldown
(`exclude-newer`). The CLI is an honest stub: every verb exits 2 and names its spec. **No verb is
implemented.** The kernel being extracted runs in production upstream (SHAs in
`docs/extraction.md`).

The doc set was consolidated 2026-08-12 from seven files to four after a repeatable cold-read test
returned **converging** — the earlier tarball false-mechanism is dead, both readers "mostly-clear" —
while flagging that contradictions were accumulating between files. Superseded documents live in git
history (the root commit), not the tree.

## v0 scope

**`vsor init` → markdown in a folder → both surfaces serve it, honest about what it does not know.**

- Governance **level 0 only** — no `governance/` directory, which removes `sor-governance` from v0
  entirely.
- **One skill: `add-sources`** — the one the five-minute claim rests on.
- Naming stays Agent-Factory-flavoured; genericization comes later.

**Deferred, named as choices:** levels 1–4 · five of six skills · deployment targets beyond local ·
the customer-overlay mechanism (no schema support exists today — `corpus_id` is absent from all five
content tables) · brand genericization · the second vertical · migration tooling · benchmarks ·
governance process.

**Held open on purpose — decided at the keyboard, not from a document:** the build record's exact
fields (when writing `build`) · whether `git rev-parse HEAD:knowledge` is the right corpus identity
(first rebuild detection) · chunking parameters for a non-curriculum corpus (first non-book corpus) ·
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
the user's `site/` stays authored-input only (the init contract's exactly-10-files holds); `vsor
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
surface on `fixtures/tiny/` · scaffold-upgrade story once 0.2.0 meets a 0.1.0 project (record enough
in `build.lock.json` to derive it later).

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
lockfile committed): `@vsor/sor-site-mdx` (Quiz, flashcards, gallery, ExerciseCard, HighlightTip,
ImageZoom + `@theme/MDXComponents` mapping — works on stock preset-classic), `@vsor/sor-site-theme`
(LessonContent, DocPageActions audited to four corpus-neutral actions, ReadingProgress, SearchBar,
ModeToggle; the token file; wrap-only swizzles), and ten `@vsor/lib-*` content-pipeline packages
with the five tab plugins collapsed into one `remark-tabs` before crossing the seam — all copied
from `ag2` at the pinned survey SHA under the owner's copy authorization, stripped per the surface
spec's exclusion contract, de-branded (CI-scanned). Phase A runs inside `make gate` (allowlist +
denylist backstop, exclusion boundary scan from the one committed `exclusions.json`, token lint at
baseline zero, prop baseline); the browser tier is `make surface` — 20 Playwright checks (B5–B14)
against BOTH stock and themed builds. The live walk caught what suites alone would have shipped:
React #418 hydration on every themed doc page for Mac readers (Node ≥21's global `navigator` made
the SSR guard dead), the build host's OS baked into shipped HTML, clipboard junk in
Copy-as-Markdown — all fixed with red-state evidence and found-live comments. Named follow-up:
per-primitive render assertions (flashcards, gallery, ExerciseCard, HighlightTip, ImageZoom) land
with the fixture docs that exercise them; search title-ranking niggle recorded beside the code.

**CI is red for a non-code reason:** GitHub Actions reports "account payments have failed or your
spending limit needs to be increased" — jobs never start. Owner action; local `make gate` and
`make surface` are the same checks and are green.

Implementation discipline is now a skill — `.agents/skills/implement-spec/SKILL.md` (breakdown per
aspect, red-first, aggressive review, live/browser verification, detail pass, truth sweep);
AGENTS.md points to it. **`vsor init` is implemented against its ratified spec** (2026-08-13,
red-first: templates as canonical bytes, `vsor.scaffold`, the cli intercept, 47 unit tests plus the
committed acceptance harness — `make gate` green with the acceptance running offline). Next at the
keyboard: `dev`/`build` per the slice-1 order (the Node spike is resolved above).

## The v0 spec map and build order (2026-08-13)

Seven specs, derived from the spec threshold (public surface · cross-package · hard to reverse ·
agent-built): `vsor/init` · `vsor/instance-format` · `vsor/build-lock` · `sor-site/surface` ·
`vsor/add-sources` (slice 1) · `vsor/serve` · `vsor/eject` (slice 2). One page each: business claim
→ observable contract → acceptance test → out-of-scope. Extraction needs no spec —
`docs/extraction.md` is that work list.

Order: **Phase 0** (workspace, Makefile, CI shell, boundary tests at baseline zero, `fixtures/tiny`
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
docker compose up -d                     # postgres + pgvector
uvx vsor init demo                    # scaffolds, git init, installs
cd demo && vsor build && vsor serve

curl -s localhost:8080/health | jq .     # 200; abstain gate reported as uncalibrated
# MCP tools/list returns exactly: outline, read, search
# a search for a phrase in the corpus returns a hit with a provenance block
# the site builds and the corpus is browsable
# build.lock.json exists and is committed
```

Corpus: `fixtures/tiny/` — ~10 markdown files with frontmatter.

**Test 2 — five minutes (proves the product claim):** from a real PDF, through a real agent, using
`add-sources`, timed. `init` → "pull in these PDFs" → "put it live" → a cited answer, and an honest
refusal for something the PDFs do not cover. **Under 5 minutes wall clock, or the finding is the
deliverable** — record where the time went.

**The first experiment:** can a usable abstention floor be derived from a ten-file corpus? The
production floor took 416 gold queries + 38 probes. Level 0 ships with the gate off and `/health`
saying so; if a floor is underivable at small scale, the honest default may become a conservative
fixed floor plus an *uncalibrated* badge. Recording this result is a v0 deliverable.

**v0 gold set:** ~10 in-corpus questions + 5 out-of-corpus probes against `fixtures/tiny/`, row
schema `{q, expect, source, kind}` (+ optional `also_ok`). Probes must include scope-adjacent
near-misses.

## Shippable checklist

- [ ] Installable from a registry with a pinnable version
- [ ] README in the proven order (one sentence → tree → quickstart → complete example → docs →
      support → licence → stability statement)
- [ ] Docs shipped inside the package (offline ground truth for agents)
- [ ] Scaffold runs on the very next command with zero edits
- [ ] CI green: lint · typecheck · unit · boundary · smoke · scaffold-builds
- [ ] LICENSE · CONTRIBUTING · CODE_OF_CONDUCT · **SECURITY.md as a normative triage boundary** (operator trust model, itemized out-of-scope, pre-answered false-positive patterns) + a short THREAT_MODEL.md for the write door and MCP surface
- [ ] CHANGELOG with breaking changes in prose, from release one
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
