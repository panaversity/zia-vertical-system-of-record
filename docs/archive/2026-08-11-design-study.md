> **ARCHIVED — not authoritative, not in the reading order.**
> Frozen research artifact from 2026-08-11. Kept because the reasoning is real work and the
> citations are load-bearing. Superseded for all live purposes by `AGENTS.md`, `docs/spec.md`
> and `docs/decisions.md`. Anything here stated in the present tense describes a system that
> **did not exist** when it was written.

---

# Designing a Framework in the Agent Era

**A founding document for the Vertical System of Record Framework (`vsor`).**

Status: design concept, pre-code. Written 2026-08-11.

---

## 0. The one-paragraph version

Frameworks used to be designed for human developers reading documentation. They are now
designed for **agents building on behalf of humans**, and that inverts most of the old
craft: conventions beat configuration because agents make decisions stochastically; docs
are an API because an agent that cannot fetch and version-match your docs cannot use your
framework; errors are prompts because a machine reads them and acts; and evals belong in
the core because nobody read the code. Vercel's `eve` is the clearest working example of
this shift. Our framework sits one layer *below* eve: not the agent runtime, but the
**governed knowledge substrate that agent runtimes read from**. A vertical System of Record
is best understood not as a website and not as a database but as a **compiler** — one
governed source, compiled into as many doors as there are kinds of reader. And its product
is not retrieval. Retrieval is table stakes. Its product is **governance**: provenance,
rights basis, versioning, precedence, coverage, and the ability to say *I don't cover that*.

**One finding reframes the whole plan** (Part III): the framework is not something to
invent. `sor-agentfactory` already *is* it — domain → instance → product → runtime → gateway,
with "a new corpus is a new instance file, never a code fork" already written down as law,
and with a mature ingestion, retrieval, abstain and eval stack behind it. What is genuinely
missing is narrower and clearer than the brief assumed: **the human door is not in the
framework, the governance registers do not exist, there is no way in from outside, and the
kernel claim is untested because there is exactly one instance.**

---

# Part I — The mindset: what actually changed

## 1.1 The inversion

The load-bearing fact about 2026/27 framework design is this:

> The primary consumer of your framework is no longer a human reading your docs.
> It is an agent, acting for a human, that has never read your docs and never will —
> it will fetch the parts it needs, at the moment it needs them.

Every principle below is downstream of that single change. Where a 2015 framework
optimized for *developer ergonomics*, a 2026 framework optimizes for **agent
ergonomics** — and it turns out most agent-ergonomic decisions are also good
human-ergonomic decisions, which is why this reads less like a break and more like an
overdue tightening.

## 1.2 Twelve principles, with receipts

Each principle below is sourced to something shipped, not to taste.

### 1. The filesystem is the API

`eve`'s central move: *an agent is a directory of files*. Identity comes from the path —
`agent/tools/get_weather.ts` **is** the tool `get_weather`. From their `AGENTS.md`:

> **Derive names from file paths.** Connection names, tool names, and similar identifiers
> come from the filesystem path. Do not add redundant `name` fields to definitions.

Why this matters more now than it did: a registration step is a place an agent can get it
half-right — write the file, forget the import; add the tool, forget the manifest. A
convention that makes the file its own registration deletes an entire class of
agent-authored bug. Convention-over-configuration stopped being about typing less and
became about **determinism**.

*For us:* a governed source is a directory. A source register entry, an outcome contract,
a reflex, an eval — each is a file whose path is its identity.

### 2. Docs are a runtime artifact, versioned with the code

`eve.dev` ships four machine surfaces: `/llms.txt` (curated index), `/llms-full.txt` (whole
corpus), `/sitemap.md` (exhaustive map), `/agents.md` (operating instructions for coding
agents) — plus a `.md` twin of every HTML page. The detail that shows they thought it
through:

> For an installed project, prefer `node_modules/eve/docs/`: those docs match the
> installed eve version, while eve.dev documents the latest release.

**Docs ship inside the package, version-matched.** An agent working in a repo pinned to
`eve@0.11.4` reads `0.11.4` docs, not whatever is on the website today. That is the single
most copyable idea in the whole framework, and almost nobody does it.

*For us:* the framework ships its own docs in-package, and — because we *are* a knowledge
system — the framework's docs should themselves be a vsor instance. Which is principle 10.

### 3. Progressive disclosure is the universal pattern

The same three-tier shape appears independently in three places in 2026:

| Layer | Tier 1 (always on) | Tier 2 (on match) | Tier 3 (on demand) |
| :--- | :--- | :--- | :--- |
| **Agent Skills** (Anthropic, spec opened Dec 2025) | name + description, ~100 tokens | `SKILL.md` body, <5k tokens | `references/`, `scripts/` |
| **eve context control** | `instructions.md` | skill loaded via `load_skill` | sandbox files via tools |
| **SoR retrieval** (already in our Python service) | `outline` | `grain='section'` | `grain='lesson'` / full read |

Three teams, three problems, one answer. Treat it as settled architecture, not a
technique. Anything that is always in context must earn its place against a budget; the
default is *discoverable but not loaded*.

*For us:* an outcome contract's *summary* is always-on; its evidence rules load on match;
the cited source text loads on demand. Build the corpus with three grains from day one.

### 4. Errors are prompts

An error message is now read by a machine that will immediately act on it. It must contain
the *next action*, not just the diagnosis. Its sibling requirement is
**machine-readable introspection as a first-class surface** — eve's `agents.md` literally
instructs agents:

> Verify setup with `eve info --json` and `eve channels list --json` before reporting success.

A framework in 2026 owes every command a `--json` and every failure a remedy.

*For us:* `vsor doctor --json`, `vsor info --json`, and validation errors that name the
file, the rule, and the fix.

### 5. One obvious way

> **KISS.** If there are 5 ways to do something, the simplest and most obvious one should
> be the preferred option.

The old argument for this was taste. The new argument is arithmetic: offer five ways and
agents will sample across all five, and you will get five mutually incompatible codebases
that all technically use your framework. A golden path is now a **compatibility
guarantee**.

This is the same claim the Ecosystem Concept makes about teaching — the governed sequence
*is* the pedagogy — applied to APIs. Structure is how you get determinism out of a
stochastic builder.

### 6. Code is liability; wrap your dependencies

> **Code is liability.** Each net-new introduced snippet should earn its right to exist.

> **Wrap third-party dependencies.** ... The `eve` package should aim to keep `nitro` as
> its only runtime dependency. This keeps eve installs as small as possible and avoids
> exposure to hijacked nested dependencies.

Note the second clause: dependency minimalism has been re-justified as a **supply-chain
security posture**, because agents now install things at machine speed. They also prefer
*vendoring generated artifacts* over adding runtime deps.

### 7. Verifiability belongs in the core

eve ships `eve eval` with the framework: `evals/*.eval.ts`, file path is the eval's
identity, gates vs. soft assertions, LLM-as-judge with a configured judge model,
`mockModel()` for determinism, `--strict` for CI.

When an agent builds with your framework, no human read the diff. The only thing between
"it compiled" and "it is correct" is a test the framework made cheap enough to write.
**Evals are not a testing feature. They are the correctness story.**

*For us this is doubled*: the book's own method already demands an evaluation set covering
six case classes — routine, incomplete, conflicting, wrong-jurisdiction, escalation, and
forbidden. That is a spec for `vsor eval`.

### 8. Machine-checkable invariants, with ratchets

> Machine-checkable invariants are enforced by `pnpm guard:invariants`, which runs in the
> CI lint job. If the guard fails, fix the violation rather than editing the baseline —
> **baselines may only shrink.**

A one-way ratchet on entropy. Cheap to build, and it is what keeps a framework from
decaying once agents are contributing to it at volume.

### 9. Scaffolding is the onboarding

`npx eve@latest init my-agent` → deps installed, git initialized, dev server running, in
under a minute. Plus eight first-party templates. Not a tutorial. A working thing.

The 2026 reading: a template is a **specification an agent can execute**, which is exactly
the argument the Ecosystem Concept makes for shipping sample repositories rather than
descriptions — *"building from a proven copy is faster than building from a description,
and the result inherits every fix the kernel has already received."*

### 10. Self-application is the correctness proof

> **The core is lean and powerful.** The framework core should be simple yet highly
> expressible i.e., **`eve` can be built with `eve`**.

*For us, the strongest possible version:* **the Agent Factory SoR must itself be an
instance of the framework.** Not a cousin of it, not the thing it was extracted from — an
instance, rebuilt on the kernel, inheriting every fix. If the framework cannot express the
corpus it was extracted from, it cannot express anyone else's.

### 11. Pre-1.0, prefer breaking changes

> Favor correctness and simplicity over backwards compatibility. **No legacy fallback logic.**

Say it out loud in the README and it stops being rude. It is also the only way a kernel
stays a kernel: every compatibility shim is a permanent tax on all future instances.

### 12. Ship a skill for your own framework

eve maintains `skills/eve/SKILL.md`, published to registries, whose guidance
*"defers to version-matched bundled docs."* Skills registries (skills.sh, launched Jan
2026; skills-hub; SkillsMP) are now a real distribution channel — Vercel, Prisma, Supabase,
Stripe, Coinbase and Microsoft all shipped official skills before Q1 2026 closed.

**Your framework's usage knowledge is a shippable artifact.** If you do not author it,
agents will infer it from stale blog posts.

## 1.3 The one thing eve gets to skip that we do not

eve's users are developers who chose it. Our users include a *domain expert* — an
accountant, a lawyer, a sales leader — who is licensing their knowledge into a corpus and
who will never open a terminal. That is a second authoring audience with no analogue in
eve, and it is the hardest constraint in the whole design. It is why the governance model
has to be data (reviewable, diffable, approvable) and not code.

---

# Part II — What Vercel actually built, precisely

Read as a reference architecture rather than a competitor.

## 2.1 The shape

```
my-agent/
├── package.json
├── agent/
│   ├── agent.ts              # the model it runs on      (defineAgent)
│   ├── instructions.md       # who it is                 (always-on prompt)
│   ├── instrumentation.ts    # OTel, root-only
│   ├── tools/                # what it can do            (one tool per file)
│   ├── skills/               # what it knows             (SKILL.md, on demand)
│   ├── subagents/<id>/       # who it delegates to
│   ├── channels/             # where it lives            (HTTP, Slack, Discord…)
│   ├── connections/          # what it talks to          (MCP, OpenAPI)
│   ├── schedules/            # when it acts              (cron)
│   ├── hooks/                # lifecycle subscribers
│   ├── sandbox/              # isolated compute + seeded workspace
│   └── lib/                  # import-only shared code
└── evals/                    # scored checks             (eve eval)
```

Auto-discovered by name. `eve info` reports what was discovered and why something wasn't.

## 2.2 The six things that ship in the box

Durable execution (sessions on Vercel Workflows — checkpointed, survive crashes, deploys
and indefinite pauses), sandboxed compute (microVMs; agent-generated code treated as
untrusted), human-in-the-loop approvals (a field on a tool), subagents, OpenTelemetry
tracing plus a zero-config Agent Runs dashboard, and evals.

The claim underneath: *the gap between a demo and production is where agent projects die,
so the framework closes it by default rather than by tutorial.*

## 2.3 Extensions — the kernel/instance pattern, done well

This is the piece most worth stealing. An extension is an npm package shaped like an agent
(`extension/tools/`, `extension/skills/`, `extension/hooks/`, `extension/instructions.md`),
with typed config validated by Standard Schema. You mount it by creating one file:

```ts
// agent/extensions/crm.ts  →  namespace becomes `crm__`
import crm from "@acme/crm";
export default crm({ apiKey: process.env.CRM_API_KEY! });
```

`tools/search.ts` becomes `crm__search`. State is auto-scoped to the package. And
critically — **you can override a contribution without forking**:

```ts
// agent/extensions/crm/tools/search.ts — add an approval gate to a vendor tool
import { search } from "@acme/crm/tools";
export default defineTool({ ...search, approval: always() });

// …or remove it entirely
export default disableTool();
```

That is the exact ergonomic a "fix the kernel once and every instance inherits it" claim
requires, plus the escape hatch that keeps inheritance from becoming a cage. Instances stay
upgradable *because* customization has a named, non-destructive place to live.

## 2.4 The design template — a System of Record in miniature

The `eve-design-template` is a Slack agent that answers only from *"a reviewed, versioned
corpus of your organization's approved design guidance."* Its structure:

- `knowledge/sources/` — immutable snapshots of source material
- `knowledge/guidelines/` — distilled, actionable rules
- `knowledge/manifest.json` — **identity, ownership, provenance, precedence, access, approval status**
- `BOOTSTRAP.md` — guided first build of the corpus
- `REFRESH.md` — the only sanctioned update path, requiring explicit owner approval

Until an owner approves, the agent refuses to answer. The corpus is bundled at build time
and **immutable at runtime**; conversations and attachments never write back into it.

Vercel arrived independently at *sources vs. distilled rules*, *a manifest carrying
precedence and approval*, and *approval as a hard gate*. That is strong convergent
evidence that the book's governance model is the right shape.

## 2.5 Where the template stops, and our lane begins

The design template bundles a small corpus at build time with **no retrieval at all** —
correct for a hundred design rules, useless for a profession's body of knowledge. It has
no human door, no jurisdiction or effective-date model, no rights basis, no coverage
register, no abstention contract, and no notion of a source hierarchy resolving conflicts.

So the positioning is clean, and it is not a competitive one:

> **eve owns the agent runtime. `vsor` owns the knowledge substrate the runtime reads from.**
> A vertical SoR should be consumable by an eve agent as an MCP `connection`, and
> shippable as an eve `extension`.

We should ship that extension ourselves. It is a distribution channel, not a concession.

---

# Part III — What already exists (the finding that changes the plan)

The brief assumed this framework starts from two repos and a blank directory. It does not.
**Both repos have already extracted half a kernel each**, independently, without knowing about
each other. Reading them changes the work from *invent a framework* to *join two existing
halves and prove the result with a second instance.*

> `ag2/libs/docusaurus/*` is the **human door's** kernel — an nx workspace of 14 shared
> packages that `learn-app` consumes as a client, not an owner.
> `sor-agentfactory/packages/*` is the **agent door's** kernel — a `uv` workspace of six
> packages behind a declarative instance contract.
> They share a corpus and **nothing else**: not a config file, not a build, not a provenance
> chain. **The framework is the seam between them — one instance definition that drives both.**

That framing is smaller and far more tractable than "build a framework," and it explains the
`rendered: base_url` provenance gap directly: there is no shared build for the corpus to be
hermetic to. Everything else in this part is detail underneath that sentence.

## 3.1 The layering is already there, and it is correct

From that repo's own `README.md`:

```
domain (library)  →  instance (config)  →  product (composition)  →  runtime (launcher)  →  gateway (wire)
sor-content          instances/content/…    gateways/zia-tutor/       sor-gateway-kit        gateways/<name>/main.py
sor-learning         "this corpus, this DB, "content + learning +     constructs opaque      builds the MCP
sor-pedagogy          which pages, floor"    pedagogy, expose 8 tools" component handles      surface + auth
```

> **Instance** = one domain, configured for a deployment … **A new corpus is a new instance file.**
> **Product** = a composition of instances + persona + exposure … **A new connector is a new
> product file — never a code fork.**

That is the kernel/instance separation the Ecosystem Concept promises, already written down
as law. It is also *better than the single-level config I had drafted*: **instance** (one
domain configured) and **product** (a composition of instances plus persona plus exposed
tools) are genuinely different things, and collapsing them would have been a mistake. Adopt
this vocabulary rather than inventing a parallel one.

Ports-and-adapters as a `uv` workspace, with **AST boundary tests enforcing every edge** —
eve's "machine-checkable invariants" principle, already implemented.

## 3.2 What the packages already do

| Package | What it holds |
| :--- | :--- |
| `sor-platform` | bundle loading + SHA-pinning, db, frontmatter, contracts, wire, env, kv, limits, errors |
| `sor-gateway-kit` | `build_auth` (fail-closed), `run_gateway`, manifest, publish, wiring, hardening |
| `sor-content` | the content engine: `service.py`, `lib/{search,read,abstain,windowing,snapshot,embedding}`, `ingest/{chunking,build,drift,gc,generation,manifest,rendered,worker}`, `ingest/adapters/{docusaurus_sidebar,plain_tree}` |
| `sor-learning` | the learner record — read/write, teacher view, candidate tools |
| `sor-pedagogy` | the voice and method — the Identity Record, in effect |
| `sor-evals` | a real eval harness: judge, grader, benchmark, measure, pacing, transitions |

Four details are exactly right and easy to lose in a rewrite:

- **`ingest/adapters/`** already has two adapters, and `manifest.py` states the kernel thesis
  outright: *"plain-tree emits the same shape from a directory tree — the kernel cannot tell
  them apart."* The source shape is already pluggable and already proven twice. A vertical
  whose corpus is a set of policy PDFs is a third adapter, not a fork.
- **`tools/*.md`** — tool descriptions are authored as Markdown beside the code and treated
  as the agent-facing contracts they are. A test asserts **byte-identity** of the compiled
  descriptions and parameter schemas against a frozen baseline, which is what makes the
  contract actually kept rather than merely intended.
- **The schema is already domain-neutral.** It is not lesson/section/passage tables; it is
  `content_nodes` (recursive, N-deep, `kind` free-text with *no CHECK constraint* — the
  vocabulary is adapter-defined) → `sources` (one per file) → `chunks`, with within-document
  heading hierarchy stored as a path on the chunk. I had this wrong before reading it: the
  structure needs no generalizing. Only the *config field names* and the *description prose*
  are curriculum-shaped.
- **Chunking has zero overlap, by design.** Concatenating a node's chunks in ordinal order
  reproduces the body byte-exact, and that invariant is tested. It is what lets `read` be
  byte-exact and lets windows page losslessly — a property most chunkers throw away on day
  one and can never recover.

## 3.2b Three findings worth acting on separately

The recon surfaced three live defects that are not design questions:

1. **The brand leak in frozen wire params.** Tool *names* are already generated from the
   instance's `brand` field (`search_{brand}`, `outline_{brand}`, `read_{brand}_lesson`) —
   that seam is done. But `_wire_params.py` embeds the literal strings `outline_agent_factory`
   and `search_agent_factory` *inside the parameter descriptions*. Set `brand: accounting` and
   you ship a tool named `search_accounting` whose own parameter documentation tells the model
   to call `outline_agent_factory`. This is the single sharpest trap in the extraction.
2. **The rollback that never rolled back.** `retrieval_log.action` has a closed CHECK
   constraint; `'generation_rolled_back'` is not in it, so the audit INSERT aborts the wrapping
   transaction and silently undoes the pointer restore. The automated rollback path has never
   worked.
3. **A frozen-schema divergence.** The wire schema advertises `k` up to 1000; the service
   clamps at 50 and returns a `k_note`. The baseline was frozen before the clamp landed.

## 3.3 `instance.md` is the format, and it already solves the hard part

The instance file is Markdown with YAML frontmatter — and **the two halves serve the two
consumers**. The frontmatter is machine config; the body is the system prompt the MCP server
hands the agent. One file, both doors. That is the whole thesis of this framework, already
expressed in its own configuration format.

The frontmatter carries `format`, `kind`, `id`, `corpus_id`, `brand`, a
`runtime: { requires: ">=1.0,<2.0", capabilities: [...] }` **kernel version + capability
contract**, `database: { dsn_env, tenant_id }`, the corpus declaration (adapter, source ref,
which pages, ordering), `retrieval: { vector_floor }`, and `budgets`.

Three things in it are better than what I had specified:

1. **`undeclared_ok:` is a coverage gate that makes silence impossible.** Every page in the
   source book must be either declared in `pages:` or listed here *with a written reason*; a
   page in neither fails the `sor-content-drift` check. Its own comment states the principle
   perfectly: *"Adding a page here is a decision with a name on it, not a silence."* That is
   the Coverage Register, already built, and stricter than the book's prose version.
2. **The abstain floor is calibrated and its provenance recorded inline** —
   `vector_floor: 0.634` carries the calibration date, the corpus it was measured on, the
   AURC, the zero-false-abstain floor, and why the max-margin midpoint was chosen.
   `keyword_floor` is *deliberately absent*, with the measurement that killed it recorded
   beside it. Every number has a date and a method.
3. **`rendered:`** solves a real problem the naive design misses entirely: pages whose
   Markdown body is a single JSX mount, whose prose lives in React. Ingested as authored they
   land as 18–114 characters and cannot be retrieved by their own title. A declared shell with
   no rendered source is a hard publish error.

## 3.4 So what is actually missing

This is the real work list, and it is much better scoped than "build a framework."

1. **The two halves are not joined.** `learn-app` lives in a different repo, coupled only by
   the `docusaurus-sidebar` adapter and a `rendered.base_url` fetch against the *deployed*
   site — so corpus provenance today is *"whatever was live at publish time."* The instance
   file already names the fix (`build_dir` instead of `base_url`, once one pipeline builds
   both). **Joining the builds is the single highest-value structural change**, and it is what
   the two-repo brief was really pointing at. Detail in `docs/extraction-learn-app.md`.
2. **The governance registers do not exist.** There is tenant scoping, generational storage,
   drift gating and change tracking — excellent operational governance. There is no source
   register with a rights basis, no jurisdiction or effective-date model, no outcome
   contracts, decision maps, exception entries or invariants list. A *textbook* does not need
   them. **Accounting, law and medicine cannot ship without them.** This is the layer that
   turns a content SoR into a vertical SoR.
3. **There is no way for a stranger to start.** No `init`, no template, no scaffold, no
   published package, no docs-in-package. Today the kernel is reachable only by people who
   already work in the repo.
4. **The kernel claim is untested, because there is exactly one instance.** A kernel with one
   instance is an application with a config file. Nothing proves the seams hold until a
   second, genuinely different corpus runs through them unmodified.

Everything in Parts IV–VI below should be read against that list.

## 3.5 Two config seams, checked

**1. The FTS language is genuinely hardcoded — there is no config path that defaults to
English.** Verified 2026-08-11:

- `schema/schema.sql:116` — `search_tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED`
- `lib/search.py:86, 89, 113, 117` — `websearch_to_tsquery('english', …)` in both the hybrid
  and keyword-only arms
- `instance.py:116` — `_RawRetrieval` carries **only** `vector_floor` and `keyword_floor`.
  There is no `text_search_config` or language field on the instance contract.
- `scripts/bootstrap-prod.sh:16` applies `schema.sql` as plain SQL, one-time, refusing a
  non-empty DB. Nothing templates it.

The asymmetry is what makes this worth doing early rather than the size of the change. Adding
the field and templating five call sites is an afternoon *now*. After a corpus ships it is a
schema migration on a **STORED GENERATED** column plus a full rebuild, because the tsvector is
materialized per row. Note this only bites a vertical whose corpus is not English or wants a
different stemmer — but "an accounting SoR for a non-English jurisdiction" is a plausible second
instance, which is exactly when it would be discovered.

**2. The embedding model can be decided later, and here is the reasoning for when.** It ships
in the image (`config.py:8`), not the bundle, and `server.py:30-43` flags the hazard: a
generation embedded with one model and queried with another ranks nonsense with **zero errors**.
Unlike the FTS case this is *not* baked into stored rows in the same way — a model change
already forces a deliberate full re-embed, and the DB enforces one model per tenant with a named
trigger, so the failure is loud at ingest. The only silent path is *serve-time* mismatch, and a
drift check already exists for it. So: safe to defer until there is a second instance that
actually wants a different embedder, at which point the recipe moves into the instance
definition and the drift check stays. The cost of deferring is one env var of coupling; the cost
of deferring the FTS decision is a rebuild.

A third is a judgement call rather than a deadline: **table and role names stay.** Multi-tenancy
is already `tenant_id` plus forced RLS, and multi-corpus is already `corpus_id`. A second
vertical should be a second tenant or database, not a table prefix. Renaming buys nothing and
costs every SQL constant.

## 3.5b Where each fix belongs

Since the Agent Factory products have had real production runs, some of these are upstream bugs
and some are framework work, and conflating them would stall both.

| Fix | Where |
| :--- | :--- |
| `retrieval_log.action` CHECK missing `'generation_rolled_back'` | **Upstream, now** — the rollback path is broken in production today |
| Frozen wire schema advertising `k ≤ 1000` against a clamp of 50 | **Upstream, now** — an agent-facing contract that lies |
| `_wire_params.py` brand leak | **Framework** — harmless while there is one brand, fatal at the second |
| FTS language field | **Upstream schema, before the second instance** |
| Embed recipe into the instance | **Framework, deferred** (see above) |
| `lib/steps.py` → `sor-curriculum` | **Framework** — it is correct where it is until there is a non-curriculum instance |
| Five tab remark plugins → one; two OG scripts → one | **Upstream in `ag2`, before extraction** — never carry known duplication across a seam |

## 3.6 Three decisions to carry into the kernel unchanged

These are the parts that are better than what a clean-sheet design would have produced, and
they should survive extraction untouched.

1. **The digest is the authorization.** The bundle SHA is verified before any parse, pinned
   into every snapshot token (so a token from one deployment is refused by another), recorded
   in `ingestion_runs` and every audit row, and diffed at `/health` against the served
   generation to surface config drift. The tarball is byte-reproducible — built with
   `mtime=0`, zeroed uid/gid, sorted entries, and gzip's own header mtime zeroed — precisely
   so incidental whitespace cannot move the digest.
2. **Generational rebuild with eval-before-flip.** Build invisibly at generation N+1, carry
   embeddings forward by content hash (an embedding is a pure function of embed-input and
   model, so identical input yields a byte-identical vector — cost scales with *change*, not
   corpus size), gate on health plus model consistency plus a structural shrink guard plus an
   acceptance eval **pinned to the candidate while the old generation still serves**, then
   flip one pointer monotonically. The failure mode becomes *staleness, never corruption*, and
   there is nothing to roll back.
3. **Abstention as a calibrated, config-driven gate — with the negative results written into
   the source.** `vector_floor: null` means uncalibrated, which means the gate is off and
   `/health` says so loudly. The keyword-floor and title-boost experiments that *failed* live
   in the code beside the constants they explain, so the next person does not re-derive them
   by intuition. For a kernel aimed at accounting, sales, law and cuisine, that discipline —
   measure per corpus, record what lost — is worth more than any particular constant. And it
   is why `vector_floor: 0.634` must never be copied to another vertical: recalibrate.

---

# Part IV — The design concept

## 4.1 A System of Record is a compiler

Not a website. Not a database. A **compiler**:

```
        governed source (markdown + typed governance data)
                              │
                        vsor build
                              │
   ┌──────────┬───────────┬───┴────┬────────────┬──────────┐
   ▼          ▼           ▼        ▼            ▼          ▼
human       agent      skills    evals      discovery   packet
 door        door      bundle    suite      surfaces    schemas
(site)      (MCP)    (SKILL.md) (6 classes) (llms.txt)  (SoC)
```

Docusaurus compiles MDX → a site. eve compiles `agent/` → a durable service. `vsor`
compiles a *governed corpus* → every door its readers need. Adding a door must never
require touching the source. That is the whole test of whether the abstraction is real.

## 4.2 There are not two consumers. There are seven.

"Humans and AI agents" is the right starting frame and the wrong finishing one. Design for
seven from the outset, because each one changes the source format if retrofitted:

| # | Reader | Needs | Door |
| :-- | :--- | :--- | :--- |
| 1 | Human learner / practitioner | authored sequence, navigation, search | Docusaurus site |
| 2 | Agent in a chat client | grounded answers with register-row citations | MCP connector |
| 3 | Coding agent building a worker | the corpus as an executable spec | skills bundle + templates |
| 4 | The expert twin (tutor) | knowledge + identity + learner record | MCP + identity records |
| 5 | Crawlers and other models | cheap bulk access | `llms.txt`, `.md` twins, sitemap |
| 6 | **The author and the domain expert** | authoring, validation, preview, approval | CLI + CI gates + review UI |
| 7 | **The eval harness and the auditor** | golden cases, citations, provenance replay | eval suite + manifest |

Readers 6 and 7 are the ones everybody forgets, and they are the two that decide whether
the thing is a System of Record or just a search box.

## 4.3 The product is governance, not retrieval

The book says it flatly, and it is the sentence the whole framework should be built to
honour:

> Search alone is not a System of Record — governance (owner, versions, review, access
> control) is the product.

The 2026 evidence backs this hard. The "is RAG dead" argument resolved to: *naive
chunk-and-retrieve is dying; retrieval is fine.* Agentic systems increasingly navigate
corpora just-in-time rather than pre-indexing them into a vector store. Meanwhile the
governance gap is measured and severe — governed context takes agent accuracy from
roughly 10–31% to 94–99%, and an estimated 85% of enterprise AI systems cannot reconstruct
why a decision was made.

So: retrieval is a commodity that will keep changing. **Do not build the framework's
identity on pgvector.** Build it on the registers, and treat retrieval as a swappable door.

Concretely, our existing Python service is already on the right side of this trend — it
exposes `outline` → `read` → `search`, i.e. navigation first and search as one tool among
several, with grain and token budgets. That is agentic retrieval, not naive RAG. Keep that
shape and make it a kernel contract.

## 4.4 The source model: the seven templates become typed data

The book's design method already specifies the artifacts. The harness's job is to promote
them from prose to **validated, diffable, compiled data** — because the moment they are
typed, the Definition of Done becomes a CI job.

| Book template | Framework artifact | Mechanically enforceable? |
| :--- | :--- | :--- |
| Outcome Contract | `governance/outcomes/<id>.yaml` | ✅ required fields; every outcome has ≥1 eval |
| Sort Record | `governance/sort-record.yaml` | ✅ every element sorted; Bin 1 items must cite a source |
| Invariants List | `governance/invariants.yaml` | ✅ each invariant names its enforcement: tool, gate, or policy — **never prose alone** |
| Source Register | `governance/sources.yaml` | ✅ **rights basis required on every source**; no unregistered source may be cited |
| Decision Map | `governance/decisions/<id>.yaml` | ✅ rule vs. judgment vs. permission separated; every decision names a governing source |
| Exception Entry | `governance/exceptions/<id>.yaml` | ✅ every exception has a detection, an escalation target, and an eval |
| Coverage Register | `governance/coverage.yaml` | ✅ generated + checked; drives the abstention contract |

Plus two more the method demands:

- **Content class.** Every page is `authority` or `orientation`. Orientation is plain-language
  onboarding for humans and **is never cited by an agent** — so the class is not a label, it
  is a retrieval filter. The compiler enforces it; the MCP door honours it.
- **Reflexes.** Derived procedures, authored in the expert's voice, built around outcomes and
  Bin 1 invariants. These are `SKILL.md` files. The book's method and the Agent Skills spec
  are describing the same artifact, and we should ship them in that format so any agent
  runtime can load them.

## 4.5 The invariants we enforce in code

Lifted from the System of Context page's eight invariants, reduced to what a *framework*
can actually guarantee (the rest belong to the context layer, which is a different product):

1. **Authority never moves.** Every retrieval result carries a citation to a *source register
   row* — publisher, authority class, jurisdiction, version, effective period, stable ID —
   not merely a chunk of text. This is a response-schema requirement.
2. **Discovery ≠ confirmation.** `search` returns pointers; `read` confirms. The tool
   descriptions must say so, because tool descriptions are the agent's contract.
3. **Provenance travels.** Summarization never strips source labels. Enforced in the response
   schema, not in a prompt.
4. **Conflict is preserved, never blended.** When two registered sources disagree within
   scope, the door returns both with their precedence rank. It never merges them.
5. **Abstention is a first-class answer.** `abstained: true` means *the corpus does not cover
   this* — a real answer, never an error, and never a licence to fall back on model
   knowledge. Coverage register and abstention are the same mechanism seen from two sides.
6. **Ungoverned stays ungoverned.** Nothing enters the corpus without a register entry and a
   rights basis. Promotion is authorship: reviewed, attributed, recorded.
7. **Freshness per field.** The framework governs *knowledge*, which is versioned and
   effective-dated. It must never cache *state* — balances, statuses, current numbers. If a
   value can change under you, it is not ours to serve.
8. **Approval gates publication.** An unapproved corpus does not ship. Copy eve's design
   template exactly here: refuse to answer rather than answer ungoverned.

Invariants 1–5 are testable from outside the system, which means they belong in the
framework's own eval suite and should be runnable against *any* instance:
`vsor verify --instance ./my-sor`.

Three are already partly built, which is worth knowing before anyone re-implements them. Every
hit already carries `provenance{corpus_id, stable_id, slug, generation, retrieved_at}`, so
**invariant 3 needs extending, not inventing**. Abstention (invariant 5) is a calibrated module
with `abstained: true` on the wire. And the publish step already implements *discovery is not
confirmation* at the URL layer: `resolve_permalinks()` fetches the live sitemap and **drops any
route the site does not list** rather than storing a guess — `permalink` is NULL before it is
wrong. The real gap is that authority today points at a content node, not at a registered
source carrying a rights basis, a jurisdiction and an effective date.

## 4.5b The plane I under-weighted: behavior ships with the corpus

The research draft is right about something my first pass treated as an afterthought. A vertical
SoR ships not only content but **the rules of engagement for the agents that consume it** — and
that is the sharpest departure from generic RAG.

The live Zia connector already proves the pattern: its instructions define a persona, a
grounding contract (*"ground every subject claim in a Content SoR tool call THIS turn"*),
abstention semantics, record-keeping duties, and evidence gates on claimed progress. That is not
documentation. It is a shipped, versioned artifact that turns a generic frontier model into this
corpus's reader.

Generalized, that is an **`agents/` plane** with one instruction pack per consumer role:

| Pack | Turns a generic agent into | Ships with |
| :--- | :--- | :--- |
| `tutor` | the vertical taught in the expert's voice | identity, method, learner-record contract |
| `developer` | a builder of Workers from the SoR | architecture selection, 10-80-10, the spec the record already supplies |
| `worker` | a performer of the profession's outcomes | invariants, permissions, exception paths, escalation format |

Authority-versus-orientation, the source hierarchy, and *cite or escalate* are stated once in
the pack and **enforced by the gateway and the checkers** — never left to prompt prose. This is
also where the framework's commercial surface lives: an instruction pack is small, portable,
and licensable, and it is what makes the same corpus serve teaching and doing without forking.

Note the placement test the method already gives, which decides what goes where and needs no
invention: **find-and-cite → corpus; load-and-follow → skill.** The map is a small skill listing
what exists and when each source must be read; a reflex is loaded whole, one outcome per reflex,
small enough to hold in working attention.

## 4.6 What this buys the FDE, stated plainly

The Ecosystem Concept promises an 80/20 split — a shared base every customer gets, plus
the 20% only one customer needs — and the reason SaaS could never do that was cost of
customization. The framework is what makes the 80 concrete: **the 80% is the kernel plus
the vertical's registers; the 20% is a customer overlay that never edits the vertical's
source.** Extensions-with-override (§2.3) is the mechanism. If a customer deployment has
to fork the corpus, the model is broken, because forks stop inheriting the day they ship —
which is exactly the failure mode the book indicts bespoke software for.

---

# Part V — The structure

Written to *extend* what §3 found, not to replace it. The existing vocabulary — domain,
instance, product, runtime, gateway — stays. What is added is the human door, the governance
registers, and a way in from outside.

## 5.1 What `vsor init my-sor` gives you

**One project, scaffolded into the user's own repo** — the web runtime, the gateway, ingestion
and evals all inside it, alongside their corpus and their licence. Copy-into-repo, the shadcn
model; not a platform they rent.

> **Revised.** An earlier draft split this across four repos so an expert could own and take away
> their corpus. That was solving an *accident* — the Agent Factory corpus is trapped inside a
> private 10-app monorepo — not a property of the framework. **Ownership comes from the scaffold,
> not from repo separation.** Scaffold into the user's own repo and they own all of it from minute
> one.

```
my-sor/                           # created by `vsor init my-sor` — yours, your licence
├── AGENTS.md                     # how an agent works in this project — read first
├── LICENSE                       # yours
│
├── .agents/skills/               # ← THE PRODUCT SURFACE (§5.3)
│   ├── add-sources/SKILL.md      #   PDFs · folders · URLs → governed markdown
│   ├── review-coverage/SKILL.md  #   what it covers · what it will refuse
│   ├── add-governance/SKILL.md   #   climb the ladder (§5.3b)
│   ├── define-policy/SKILL.md    #   who may see what
│   ├── deploy/SKILL.md           #   put the connector live
│   └── build-worker/SKILL.md     #   a Digital FTE from the corpus
│
├── instance.md                   # UNCHANGED FORMAT — frontmatter is machine config,
│                                 #   body is the agent-facing system prompt
│                                 #   + new keys: site:, auth:, use_scope:
│                                 #   NOT governance — see the line below
│
├── knowledge/                    # THE CORPUS — everything here ingests by default
│   ├── <collection>/**/*.md(x)   #   frontmatter: class, source_id, jurisdiction,
│   └── _assets/                  #   effective_from/to, owner, approval, sidebar_position
│
├── governance/                   # THE REGISTERS — the seven templates, as typed data
│   ├── sources.yaml              #   register: publisher, authority class, version,
│   │                             #   jurisdiction, rights basis, owner, stable ID
│   ├── invariants.yaml           #   each with enforcement: tool | gate | policy
│   ├── sort-record.yaml          #   keep / redesign / delete, with the why
│   ├── coverage.yaml             #   generated + checked; drives abstention
│   ├── outcomes/<id>.yaml        #   outcome contracts
│   ├── decisions/<id>.yaml       #   decision map
│   └── exceptions/<id>.yaml      #   exception entries
│
├── identity/                     # THE TWIN — today this is sor-pedagogy's zia.md,
│   ├── identity.md               #   generalized: voice, principles, method
│   └── methods/*.md              #   (optional; needed only for a tutor product)
│
├── reflexes/                     # DERIVED PROCEDURES → shipped as Agent Skills
│   └── <id>/SKILL.md             #   + references/, scripts/
│
├── agents/                       # BEHAVIOUR — shipped with the corpus (§4.5b)
│   └── tutor|developer|worker/   #   the rules of engagement for agents that read it
│
├── evals/                        # THE EVALUATION SET — six mandated case classes
│   └── <outcome>/*.yaml          #   routine · incomplete · conflicting ·
│                                 #   wrong-jurisdiction · escalation · forbidden
│
└── packages/                     # THE RUNTIME, vendored — the user owns it
    ├── sor-site                  #   human door: the book + preview/review
    ├── sor-content               #   agent door: ingest · retrieval · abstain · generations
    ├── sor-gateway-kit           #   fail-closed auth, serve loop, publish
    ├── sor-platform              #   bundles, SHA-pinning, db, contracts
    ├── sor-governance            #   the registers and the ladder
    └── sor-evals                 #   the proof
```

Path is identity, throughout — the convention `sor-content` already follows by deriving
`stable_id` from the file path rather than from a `slug:` field. `governance/outcomes/revenue-recognition.yaml`
**is** the outcome `revenue-recognition`; `reflexes/working-papers/SKILL.md` **is** the reflex
`working-papers`. No `id:` fields.

### The line between `instance.md` and `governance/`

They are different concerns and must not be merged:

> **`instance.md` declares what this *deployment* is and does.**
> **`governance/` declares what is true about the *knowledge*, and who vouched for it.**

So the corpus, the adapter, the database, the retrieval floors, the budgets, the site branding, the
auth provider and the use scope live in `instance.md` — the same corpus deployed internally and
customer-facing legitimately differs on all of them. The source register, rights bases, approvals,
invariants and coverage live in `governance/`, because those facts are properties of the knowledge
and travel with it wherever it is deployed.

**The governance level is therefore derived, not declared.** `vsor check` reads what is present and
valid under `governance/` and reports the level achieved — no `governance:` key on the instance. A
project that wants to prevent regression pins a floor in `governance/` itself, so the ratchet lives
with the thing it governs.

## 5.2 What the framework supplies

Four of these exist today and need extracting, not writing. Three are genuinely new.

| Package | State | Responsibility |
| :--- | :--- | :--- |
| `sor-platform` | **exists** | bundles, SHA-pinning, db, frontmatter, contracts, env |
| `sor-gateway-kit` | **exists** | fail-closed auth, run loop, manifest, publish, hardening |
| `sor-content` | **exists** | ingestion, chunking, hybrid retrieval, abstain, windowing, drift, generations |
| `sor-evals` | **exists** | judge, grader, benchmark, measure |
| `sor-site` | **new** | the human door — a Docusaurus preset driven by `instance.md`, serving the book **and the preview/review view** |
| `sor-governance` | **new** | the registers and the ladder: schemas, validation, precedence, citations, level checking |
| `sor-cli` | **new** | `init` for the human; `check`, `sync`, `info --json`, `doctor --json` for the agent |

Doors are plugins that consume the published bundle and nothing else. That seam is what
keeps the compiler framing honest, and the reason a future A2A or GraphQL door costs a
package rather than a refactor.

**What we own is smaller than it looks.** Two repos: this one — where the kernel is developed
and published from, plus the templates `init` materializes and the fixtures the tests run
against — and `sor-agentfactory`, which becomes **instance #1** rather than the framework's home.
Everything else is somebody's project.

Keep **fixtures** (tiny, seconds to build, for tests and `init --minimal`) separate from
**templates** (realistic, what a real builder starts from). eve makes this split and it earns its
keep: conflate them and you get either a test suite too slow to run or a starting point too thin
to learn from. And a template is not documentation — it is **the specification an agent
executes**, which is the book's own argument for shipping proven copies rather than descriptions.

## 5.3 The way in is a conversation, not a CLI

> **Revised.** An earlier draft of this section designed a nine-verb command surface for a human
> to learn. That was the inversion this document spends Part I arguing for, and then failed to
> apply. Corrected here.

**The human runs at most one command.** After that they talk, inside the agent they already
use — Claude, Codex, OpenCode, Cowork. The scaffolded project ships `AGENTS.md` and skills, so
the agent knows what the project is and how to work in it.

```
vsor init my-sor              the only command the user types
"pull in these PDFs"          → add-sources: governed markdown in knowledge/
"put it live"                 → deploy: ingest · calibrate · flip · serving
"what does it not cover?"     → review-coverage: the honest gaps
```

CLI verbs still exist — `check`, `sync`, `info --json`, `doctor --json` — but they are **what
the agent runs**, not what the user learns. Every one owes a `--json` and every failure owes a
remedy, because a machine reads them and acts (§1.2 principle 4).

**Which makes the skills the product surface.** If the agent does the work, the framework's
quality *is* the quality of its skills, and that is where the craft goes:

| Skill | What the user actually says |
| :--- | :--- |
| `add-sources` | *"pull in these PDFs" · "point at this folder" · "read these URLs"* |
| `review-coverage` | *"what does this cover?" · "what will it refuse to answer?"* |
| `add-governance` | *"we need to track where this came from"* |
| `define-policy` | *"only serve the tax section to the finance team"* |
| `deploy` | *"put this live"* |
| `build-worker` | *"build me an agent that does month-end close"* |

Skills ship **inside the project, version-matched** (§1.2 principle 2), so the agent reads the
ones matching what was installed.

### 5.3b Governance is a ladder, not a gate

The reconciliation of *"live in five minutes, no technical experience"* with *rights basis,
jurisdiction and audit replay*. An earlier draft had the gate refuse publication until all seven
registers were filled — which makes five minutes flatly impossible.

| Level | What you have | What you add |
| :--- | :--- | :--- |
| **0 · Working** | Everything ingested, both doors live, abstention **on** with a floor auto-calibrated at first ingest | nothing — this is `vsor init` |
| **1 · Sourced** | Every source has a register row with a rights basis; nothing unregistered may be cited | `governance/sources.yaml` |
| **2 · Marked** | Authority vs orientation; the agent never cites the introduction | frontmatter `class:` |
| **3 · Scoped** | Jurisdiction + effective dates; wrong-jurisdiction answerable; `as_of` queries | schema columns + frontmatter |
| **4 · Attested** | Approval rows on content hash; unapproved content is draft; auditor replay | `governance/approvals/` |

`vsor check` validates **at the declared level** — it never demands level 4 from a cuisine SoR.
A regulated vertical climbs to 4; most never leave 0. Same kernel throughout.

**Safe defaults, because "everything ingests" has a sharp edge.** Point an agent at a folder of
licensed PDFs in minute three and the framework has just helped someone do something with a
rights problem. So it works immediately **and says what it is not yet**: abstention on from the
first ingest, and the preview carries a visible *ungoverned* state — no source register, no
rights basis — until you climb.

Note this also changes what the gate *is*. It is no longer "the Definition of Done or nothing";
it is "the Definition of Done **at your level**, plus an honest badge for the levels you have not
reached." The drift gate that already exists is the level-1 mechanism, extended from *is every
page declared* to *is every source registered*.

## 5.4 The two source repos, mapped

The framing that survives contact with the code is different from the brief's. `sor-content`
is not a thing to extract *into* a framework — it *is* the framework. `learn-app` is the
piece that has never been in one.

| Repo | Becomes | The work |
| :--- | :--- | :--- |
| `sor-agentfactory/packages/*` | the kernel itself | **Extract and publish.** The schema is already neutral and tool names are already brand-derived; what is curriculum-shaped is narrower: the frozen wire-param descriptions (§3.2b), the ~5.6KB of default tool-description prose, the instance fields `crash_courses_tree` / `opening_page` / `opening_sections`, the `lesson` noun in `read_{brand}_lesson`, the Docusaurus-specific chunking classifiers, the untrusted-content advisory text, and `lib/steps.py` — which is pure education and should leave the kernel entirely for a `sor-curriculum` package, taking `service.course_map` with it. Then add docs-in-package and a version-matched skill. |
| `ag2/libs/docusaurus/*` (14 shared packages) + `ag2/apps/learn-app` (Docusaurus 3.9.2, React 19, Tailwind 4, shadcn/Radix, ~50 component dirs) | `sor-site` | **Promote the libs, strip the app.** `libs/docusaurus/*` is already the site kernel and moves mostly intact — first collapsing five near-identical tab remark plugins into one configurable plugin, and two OG-frontmatter scripts into one. Widen `shared/siteConfig.js` from `{url, baseUrl}` to the full branding block read from the instance, generalizing the existing hostname-driven `data-brand` white-label mechanism rather than replacing it. In the app, the kernel is a small set — `quiz`, `flashcards`, `ui`, `ExerciseCard`, `HighlightTip`, `ImageZoom`, `ReadingProgress`, `SearchBar`, `gallery` — while ~30 component dirs, all 12 `customFields`, all 10 env vars and the `better-auth` dependency are Panaversity's product and must not enter the framework. Then join the builds. |

---

# Part VI — What it can do

**For a domain expert (no terminal, ever):** say *"pull in these PDFs"* to the agent they already
use; open a page and see exactly what is in the corpus, what the agent will actually say for a
given page, and what it will refuse to answer; approve or reject. Their governed knowledge, in
their repo, under their licence, from minute one.

**For an FDE:** one command to a working vertical at level 0; climb the ladder only as far as the
profession needs; author the thin slice — one outcome contract, its invariants, decision map,
exceptions, reflex and eval set; ship a human site and an MCP connector from the same publish;
overlay a customer's 20% without forking the vertical's 80%.

**For an agent:** connect one MCP server and get grounded answers that cite a register row,
navigate by outline before searching, load reflexes as Agent Skills, and receive an honest
abstention when the corpus does not cover the question.

**For an auditor, six months later:** reconstruct which version of which source, under
which jurisdiction and effective date, approved by whom, produced a given answer.

That last one is the differentiator. It is also the one nobody else ships.

## 6.1 Proposed v0.1 scope

Resist building all of it. The book's own method says build one thin slice and prove it
against real professional review, so the framework should obey its own advice. Given §3,
v0.1 is mostly *extraction and proof*, not construction:

1. **Close the naming seam** — it is ~70% done. Template the frozen wire-param descriptions on
   `brand` and re-freeze the byte-identity baseline per brand; make the default tool-description
   prose generic with instance-supplied slots; add a `unit_noun` field so accounting gets
   `read_{brand}_document`; lift the education-shaped instance fields into an adapter-specific
   sub-object the kernel passes through opaquely; move `lib/steps.py` out to `sor-curriculum`.
   Settle the two baked-in decisions in §3.5 in the same pass.
2. **Bring the site in as `sor-site`.** Strip `learn-app` to its kernel components, drive
   branding from `instance.md`, and build the site in the same pipeline that ingests it —
   which closes the `rendered: base_url` provenance gap on the way.
3. **Add `sor-governance`.** The source register with rights basis first, because it is the
   one register that gates *every* regulated vertical, and extend the existing drift gate to
   cover it. The other six registers can follow.
4. **Ship the way in — and it is a conversation, not a CLI.** `vsor init` plus **the six skills**
   (§5.3), `AGENTS.md`, one template, and docs-in-package version-matched. The skills are the
   deliverable here, not the command: if the agent does the work, they *are* the product.
5. **Make the ladder real** (§5.3b). Level 0 must genuinely work in five minutes — everything
   ingested, both doors live, abstention on with a floor auto-calibrated at first ingest, and the
   preview carrying an honest *ungoverned* badge. `vsor check` validates at the declared level.
6. **Stand up a second instance in a different vertical.** The acceptance test, and not
   negotiable — a kernel with one instance is an application with a config file. It must break
   seams the book never did: a non-Docusaurus source shape, a document-conversion path,
   non-English text or a second `text_search_config`, and no licensing gate.

**Conversion is in scope, and it is a skill.** Both adapters take *finished markdown on disk*, so
"PDFs are a third adapter" is false — the conversion stage has no package and no home today. Per
§5.3 it belongs in `add-sources` rather than a CLI verb, but it still needs an origin-artifact
provenance record (converter, source bytes, page range, human fidelity attestation), or an OCR
error in a rate table is byte-indistinguishable from authored content and ships with full register
authority.

Deferred: registers above the level the proving corpus needs, customer overlays, the eve
extension, i18n, additional templates, and anything touching `sor-learning` or `sor-pedagogy`.

---

# Part VII — Where the decisions stand

**This section is no longer authoritative. The decision register is `docs/decisions.md`** — it is
the single document for the review, and it supersedes the five open questions that used to sit
here.

Summary as of 2026-08-11: **eight decisions settled** (conversation as the interface · one project
scaffolded into the user's own repo · Apache-2.0 with no code/content split · skills as the product
surface · governance as a ladder · the site as preview-and-review · the full schema bundle in one
pass · a proving corpus chosen to break seams rather than to be the moat), **five open** and all
review-and-confirm (rights vocabulary · approval unit · what gates a flip · identity and visibility
· migration policy), and **six that cannot be settled internally** — relicensing, the persona
instrument, EU AI Act classification, AICPA independence, rights-holder serving terms, and the
expert's sustainable review burden.

Two decisions drafted before reading `sor-agentfactory` were moot from the start: the runtime
language (the Python kernel is mature and staying; the site is a Node door) and the database
(Neon, already in production).

What the design has *not* addressed is a separate document: `docs/gaps-register.md` — 133 findings
from eight review lenses, deduped and ranked to 12. Read it before planning work.

---

## Sources

- [eve — The Agent Framework](https://vercel.com/eve) · [eve docs](https://eve.dev/docs) · [Vercel docs: eve](https://vercel.com/docs/eve) · [Concepts](https://vercel.com/docs/eve/concepts)
- [Introducing eve (blog)](https://vercel.com/blog/introducing-eve) · [Changelog](https://vercel.com/changelog/introducing-eve-an-open-source-agent-framework)
- [vercel/eve AGENTS.md](https://github.com/vercel/eve/blob/main/AGENTS.md) — the coding principles quoted throughout
- [eve project layout reference](https://eve.dev/docs/reference/project-layout.md) · [Extensions](https://eve.dev/docs/extensions.md) · [Skills](https://eve.dev/docs/skills.md) · [Evals](https://eve.dev/docs/evals/overview.md) · [Context control](https://eve.dev/docs/concepts/context-control.md)
- [eve design template](https://eve.dev/templates/eve-design-template) · [eve agents.md](https://eve.dev/agents.md) · [eve llms.txt](https://eve.dev/llms.txt)
- [InfoQ: Vercel introduces eve](https://www.infoq.com/news/2026/06/vercel-eve-agents/) · [The Register](https://www.theregister.com/devops/2026/06/19/vercel-debuts-eve-open-source-agent-framework-tries-to-fix-shadow-ai-with-passport/5258726)
- Agent Factory: [The Ecosystem Concept](https://agentfactory.panaversity.org/docs/ecosystem/ecosystem-concept) · [Designing the Vertical SoR](https://agentfactory.panaversity.org/docs/ecosystem/designing-the-vertical-sor) · [Choosing Your Vertical](https://agentfactory.panaversity.org/docs/ecosystem/choosing-your-vertical) · [System of Context](https://agentfactory.panaversity.org/docs/ecosystem/system-of-context) · [System of Record](https://agentfactory.panaversity.org/docs/ecosystem/system-of-record)
- [MCP 2026-07-28 specification](https://blog.modelcontextprotocol.io/posts/2026-07-28/) — stateless core, cacheable list results, authorization hardening, extensions framework
- [Agent Skills / SKILL.md](https://www.firecrawl.dev/blog/agent-skills) · [Progressive disclosure as a design pattern](https://www.newsletter.swirlai.com/p/agent-skills-progressive-disclosure) · [Skills ecosystem 2026](https://agentman.ai/blog/agent-skills-ecosystem-report-2026)
- [AGENTS.md field guide 2026](https://www.iuriio.com/blog/posts/2026/05/agents-md-field-guide-2026) · [llms.txt honest guide](https://codersera.com/blog/llms-txt-complete-guide-2026/)
- [RAG is dead, long live RAG (LightOn)](https://lighton.ai/lighton-blogs/rag-is-dead-long-live-rag-retrieval-in-the-age-of-agents) · [Agentic retrieval (LlamaIndex)](https://www.llamaindex.ai/blog/rag-is-dead-long-live-agentic-retrieval)
- [Context engineering framework for enterprise AI (Atlan)](https://atlan.com/know/context-engineering-framework/) · [AI agent governance & compliance 2026 (Zylos)](https://zylos.ai/research/2026-05-01-ai-agent-governance-compliance-2026/)
