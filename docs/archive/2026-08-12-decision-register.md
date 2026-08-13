> **ARCHIVED 2026-08-12 — not authoritative, not in the reading order.**
> Superseded by the consolidated set: `AGENTS.md` (durable), `docs/status.md` (weekly),
> `docs/extraction.md` (the join work list). Kept because the reasoning is real work.
> Known defects at archive time are corrected in the live set, not here.

---

# Decision register

**The single document for the review.** Everything else in `docs/` is evidence; this is the agenda.

> **Terminology, 2026-08-12.** This file predates two renames recorded in `AGENTS.md`: **"door" is now
> "surface"** (a thing that serves content — the website, the MCP server), and **"reader" is retired**
> as a software term because it was ambiguous between a surface and a human stakeholder. Older wording
> below is left in place rather than silently rewritten; `AGENTS.md` holds the current vocabulary.

Part A is closed — do not re-open it in the room. Part B is what remains. Part C is what cannot be
settled by us. Part D is the structure that falls out.

| Status | Count |
| :--- | :--- |
| **A** — Settled | 9 principles + 8 decisions |
| **B** — Still open | 5, all review-and-confirm |
| **C** — Needs someone outside this room | 6 |

> **Revised 2026-08-11 (second pass).** The first pass designed a CLI-first product with a four-repo
> topology. That was wrong on both counts and is corrected below — see A10, A11 and A14. The change is
> not cosmetic: it moves the interface from commands to conversation, collapses four repos into one
> project, and makes governance a **ladder you climb** rather than a gate you must clear before you
> can start.

---

# Part A — Settled

> **Part A records *decisions*. Nothing here is a claim that code exists.**
> `docs/status.md` is the only authority on what is built.

## The design concept (9)

1. **A System of Record is a compiler.** One governed source is validated once and derived into every
   surface that needs it. No surface reads another surface's output, and adding a surface never
   requires editing a corpus.
   *Revision 2026-08-12: this previously read "one gate → one bundle → N doors. A door reads the
   bundle and never the source." The bundle was a Cloud Run boot-fetch detail carried across from
   upstream, and it made two cold readers believe the website reads a tarball. There is no bundle —
   surfaces read Postgres and the built site. See `docs/status.md`.*
2. **The product is governance, not retrieval.** Retrieval is a commodity that keeps changing; the
   registers are the asset. Do not build the identity on pgvector.
3. **There are seven *stakeholders*, not two** — learner, chat agent, coding agent, expert twin, crawler, the author/expert, the auditor. **Stakeholders are not surfaces**: there are two surfaces (the website and the MCP server) and adding a stakeholder does not imply adding one. The two everyone forgets — the author/expert and the
   auditor — decide whether it is a System of Record or a search box.
4. **The kernel already exists; the job is join-and-prove.** Two repos hold half a kernel each and
   share nothing but a corpus. The framework is the seam.
5. **Positioning:** governed professional *research corpora* over MCP already exist (Thomson Reuters
   CoCounsel Legal, GA May 2026). Our claim is the narrow one — a governed **curriculum** with an
   **explicit abstention guarantee**, instantiable by anyone — and we name CoCounsel first.
6. **Relationship to eve:** agnostic core, first-class eve extension. eve owns the agent runtime; we
   own the substrate it reads from.
7. **Runtime:** Python kernel stays; the website surface is Node. **Production database is Neon;
   development is `docker compose` with `pgvector/pgvector:pg17`, committed** — nothing should need a
   cloud account to develop against.
8. **Table and role names stay.** Multi-tenancy is `tenant_id` + forced RLS.
9. **The embedding model can be deferred; the FTS language cannot.** *[verified — §3.5 of the design]*

## The decisions (8)

### A10 · Conversation is the interface — not a CLI ⭐

**The human runs at most one command: `vsor init <name>`. After that they talk.**

They are already standing in Claude, Codex, OpenCode or Cowork. The scaffolded project ships
`AGENTS.md` and a set of skills, so their agent knows what the project is and how to work in it. The
user says *"pull in these PDFs," "what does this cover?", "make the tax section stricter,"* and the
agent does it.

CLI verbs still exist — `check`, `sync`, `info --json` — but they are **what the agent runs**, not what
the user learns. Every one owes a `--json` and every failure owes a remedy, because a machine reads
them and acts.

*This supersedes the first pass, which designed a nine-verb command surface for a human to learn. That
was the inversion we claimed to understand and then failed to apply.*

### A11 · One project, scaffolded into the user's own repo ⭐

`vsor init <name>` produces **one project** containing the web runtime, the gateway, ingestion and
evals in `packages/`, plus `instance.md`, `knowledge/`, the skills and `AGENTS.md`. Copy-into-repo, the
shadcn model — not a platform you rent.

**`init` also initializes git** (and detects an existing repo rather than clobbering it), because the
first commit is what makes the corpus reviewable, the approval row meaningful, and the whole thing
handable to its owner. Same as `eve init`, and for the same reason: version control is not an
afterthought for a governed record, it is the substrate the governance sits on.

**Ownership comes from the scaffold, not from repo separation.** The first pass split this into four
repos so an expert could own and take away their corpus. That was solving an *accident* — the Agent
Factory corpus is trapped inside a private 10-app monorepo — not a property of the framework. Scaffold
into the user's own repo and they own all of it from minute one: kernel, doors, corpus, licence.

### A12 · Licence — Apache-2.0, one licence, no code/content split

OSI with an explicit patent grant; the licence a firm's or professional body's counsel clears without
a conversation. **No separate content licence:** the framework ships schemas and *executable* prose —
tool descriptions, instruction packs, `SKILL.md` files the server loads at boot. A second licence
creates an audit question with no good answer. The code/content split matters for a **vertical**, where
the rights basis on each registered source already handles it. `LICENSE` is written to disk (**not yet committed — the repo has no commits as of 2026-08-12**).

**One formality to record once:** a statement from Panaversity naming the paths extracted from `ag2`
(*"PROPRIETARY AND CONFIDENTIAL"*) and relicensing them, plus a check for third-party contributor
rights and vendored-dependency attributions that must travel into the extracted subset.

### A13 · Skills are the product surface ⭐

If the agent does the work, **the framework's quality is the quality of its skills.** That is where the
craft goes — not into CLI ergonomics. Six ship in the starter:

| Skill | What the user says |
| :--- | :--- |
| `add-sources` | *"pull in these PDFs" / "point at this folder" / "read these URLs"* |
| `review-coverage` | *"what does this cover?" / "what will it refuse to answer?"* |
| `add-governance` | *"we need to track where this came from"* — climbs the ladder (A14) |
| `define-policy` | *"only serve the tax section to the finance team"* |
| `deploy` | *"put this live"* |
| `build-worker` | *"build me an agent that does month-end close"* |

Skills ship **inside the project, version-matched**, so the agent reads the ones matching what was
installed — the single most copyable idea from eve.

### A14 · Governance is a ladder you climb, not a gate you clear ⭐

This is the reconciliation of *"live in five minutes, no technical experience"* with *rights basis,
jurisdiction and audit replay*. The first pass had the gate refuse publication until all seven
registers were filled, which makes five minutes flatly impossible.

| Level | What you have | What you add |
| :--- | :--- | :--- |
| **0 · Working** | Everything ingested. Both surfaces live. Abstention gate **OFF** (`vector_floor: null`), and `/health` says so loudly: *uncalibrated — this server will not refuse out-of-corpus questions.* | nothing — this is `vsor init` |
| **1 · Sourced** | Every source has a register row with a rights basis. Nothing unregistered can be cited. | `governance/sources.yaml` |
| **2 · Marked** | Authority vs orientation. The agent never cites the introduction. | frontmatter `class:` |
| **3 · Scoped** | Jurisdiction + effective dates. Wrong-jurisdiction becomes answerable; `as_of` queries work. | schema columns + frontmatter |
| **4 · Attested** | Approval rows on content hash. Unapproved content is draft. Auditor replay. | `governance/approvals/` |

`vsor check` **reports the level your `governance/` directory achieves, and never demands more** — it
will not ask level 4 of a cuisine SoR. The preview shows your current level and what the next one buys.
A regulated vertical climbs to 4; most never leave 0.

*Revision 2026-08-12: this paragraph previously said "validates at your declared level", contradicting
D2b in this same file. The level is **derived**, never declared — there is no `governance:` key on the
instance.*

**Safe defaults, because "everything ingests" has a sharp edge.** It works immediately *and tells you
what it is not yet*: the preview carries a visible **ungoverned** state — no source register, no rights
basis — until you climb, and `/health` reports the abstention gate as uncalibrated.

*Revision 2026-08-12: an earlier version claimed "abstention on from the first ingest, floor
auto-calibrated". That has **no design**, and the upstream kernel does the opposite — `vector_floor:
null` means the gate is OFF. Whether a usable floor can be derived from a ten-file corpus is the first
experiment, not a settled property. See `docs/status.md`.*

### A15 · The site is preview and review, not an editor

Authoring happens in conversation (the agent writes files) or by editing files directly. The site is
where you **look**: what is in the corpus, what the agent actually sees for a given page, what it will
abstain on, your governance level — and it carries the review and approve action.

*This supersedes the first pass's git-backed branch editor.* It keeps `sor-site` a read door plus a
review view, which is far smaller, and it matches how the work actually happens: the agent writes, the
human checks.

Two sub-items remain mandatory regardless: content changes must actually build (today they run no
build, so there is nothing to preview), and the preview must show the **"what the agent sees"** view —
chunk list, `source_type` labels, the page's retrieval score against its own title, abstain/no-abstain.
An expert cannot approve what they cannot see, and the pipeline can silently render prose unretrievable.

### A16 · Schema — all columns in one migration

With expand/contract migrations and a runner lifted from `sor-learning`'s existing numbered migrations.
Jurisdiction + effective dates + publisher + source version; `corpus_id` on the four content tables;
approval rows keyed on content hash; `text_search_config`; append-only `chunk_archive`; auditor SELECT
role; takedown write path; `action` CHECK → lookup table.

Rationale: no migration runner exists, bootstrap refuses a non-empty DB, and there is exactly **one
corpus at one generation** to migrate. Every deferred field becomes a separate DDL against live data.

*Note the interaction with A14: the columns land now, but a level-0 project simply leaves them null.
Schema readiness and governance enforcement are different things.*

### A17 · The proving corpus proves the seams, not the moat

The acceptance test's job is to break seams the book never did — **non-Docusaurus source shape, a
document-conversion path, non-English text or a second `text_search_config`, no licensing gate**, and
ideally jurisdiction or effective dates. Chosen for what it *exercises*, not what it sells.

**Consequence:** conversion is v0.1 scope. Per A13 it is a **skill**, not a package and not a CLI verb —
the agent takes your PDFs and produces governed markdown. It still needs an origin-artifact provenance
record (converter, source bytes, page range, human fidelity attestation), or an OCR error in a rate
table is byte-indistinguishable from authored content and ships with full register authority.

---

# Part B — Still open

All five have a confident recommendation and no business dependency. Review and confirm.

| # | Decision | Recommendation |
| :--- | :--- | :--- |
| **B1** | **Rights vocabulary** | Make `rights_basis` a *reference* to `governance/agreements/<id>.yaml` carrying counterparty, instrument, execution date, territory, `term_end` and an **enumerated** `permitted_uses` (ingest / embed / serve-verbatim / serve-bounded-quote / serve-locator-only / transmit-to-third-party-model / sublicense-to-customer). Add `serving_mode` and implement **locator-only now**, while it is one predicate on the read path. There is currently no serving mode below verbatim, and byte-exactness is a *tested invariant* — so a source licensed for citation but not reproduction can only be ingested wholesale or omitted. Ladder level 1. |
| **B2** | **Approval unit** | Approval is a **row, not a state**, keyed on `(source_id, content_hash, approver, date, scope)`. An edit un-approves exactly the pages it touched, so review burden is proportional to the **diff**. `content_nodes.status` already exists and is already filtered on every read, so this enforces itself for free. Add an `authored_by` class (human / agent-drafted-human-approved / agent-generated) in the same column set. Ladder level 4. |
| **B3** | **What gates a flip** | Three eval classes: **behavioural** assertions pinning no content identity (abstains out-of-corpus, cites a registered source, never cites orientation, preserves conflict) **gate**; slug-pinning relevance sets are **reported, not gating**; externally-authored correctness cases are a **ratchet whose baseline may only grow**. Add `must_contain` / `must_cite`. Record `calibrated_at_chunk_count` beside `vector_floor` and fail on drift. Make the degraded path **fail closed**. Today gold cases are generated *from the corpus being tested*, so a wrong rule generates a gold question whose correct answer is the wrong rule — the gate certifies the defect. |
| **B4** | **Identity and visibility** | Replace the derived JWKS path with **standard OIDC discovery**; make issuer/jwks_url/algorithms/audiences a list-valued auth block on `instance.md`, keyed on `(iss, sub)`. Add **`visibility`** (`public` / `customer` / `restricted`) on every collection, with the compiler **refusing to emit static public doors** for anything not public. Add a clearance label on `chunks.labels` plus one predicate on the retrieval arms. Today *"team A cannot read team B's files"* is inexpressible, and only the MCP door has an access model — so a customer's fee logic would compile to an indexed public site beside a gated connector. |
| **B5** | **Migration policy** | Write it before the first schema change: the deployed artifact is the **build** (`build_id` + its `build.lock.json` row), not the repo; unknown keys warn-and-ignore within a major; retired keys honoured for one minor; capability removal needs a deprecation release. Composition reads `schema_meta` and **fails closed with a named remedy**. Move the frozen wire baseline into the instance directory and stamp a `wire_version`. "No legacy fallback logic" has *already* failed at one instance — a retired key survives as an accept-and-ignore shim because the strict binder would otherwise crash both gateways at boot. |

---

# Part C — Cannot be settled by us

| # | Question | Who answers | Blocks |
| :--- | :--- | :--- | :--- |
| C1 | Can we relicense the extracted paths; does any contributor assignment cover them? | Counsel + Panaversity | A12 formality |
| C2 | What must a persona licence contain — scope of voice and likeness, permitted verticals, sublicensing to the FDE's customers, term, termination effect on shipped packs, post-mortem rights? | Counsel + the named expert | the identity pack |
| C3 | Are the target verticals EU AI Act **Annex III**, and what does that oblige? Obligations applied 2 Aug 2026; education and evaluation of learning outcomes is in scope, so the tutor plus learner records is arguably already caught. | Counsel | B4, disclaimer block |
| C4 | Does an FDE-built Worker doing bookkeeping-adjacent work impair a customer firm's **independence** under AICPA rules — becoming *their* peer-review finding, caused by *our* product? | Accounting counsel | A17 |
| C5 | Will the chosen vertical's rights-holders license for **MCP serving**, and in which serving mode? | The rights-holders | B1 |
| C6 | What is the expert's sustainable review burden per release? | The named expert | B2, A15 |

**One live opportunity buried in C3:** the source register, coverage register, eval suite, calibrated
abstention and retrieval ledger **already constitute most of an Annex IV technical file**. Making
`vsor check` emit an Annex IV-shaped dossier turns the largest compliance cost into the product's
strongest differentiator — and nobody else is doing it.

---

# Part D — The structure

## D1 · What `vsor init my-sor` gives you

One project. Yours, in your repo, on your licence.

```
my-sor/
├── AGENTS.md                      # how an agent works in this project — read first
├── LICENSE                        # yours
├── .agents/skills/                # ← THE PRODUCT SURFACE (A13)
│   ├── add-sources/SKILL.md       #   PDFs, folders, URLs → governed markdown
│   ├── review-coverage/SKILL.md   #   what it covers · what it will refuse
│   ├── add-governance/SKILL.md    #   climb the ladder (A14)
│   ├── define-policy/SKILL.md     #   who may see what
│   ├── deploy/SKILL.md            #   put the connector live
│   └── build-worker/SKILL.md      #   a Digital FTE from the corpus
│
├── instance.md                    # frontmatter = machine config (+ site:, auth:, use_scope:)
│                                  # body = the system prompt the MCP server hands the agent
│                                  # NOT governance — see the line below
├── knowledge/                     # YOUR CORPUS — everything here ingests by default
├── governance/                    # empty at level 0; fills as you climb
│   ├── sources.yaml               #   level 1
│   ├── agreements/                #   level 1 — the executed instruments
│   ├── approvals/                 #   level 4 — rows keyed on content hash
│   ├── invariants.yaml            #   each naming its enforcement: tool | gate | policy
│   └── coverage.yaml              #   generated; drives abstention
├── reflexes/<id>/SKILL.md         # one outcome, one reflex
├── evals/                         # three classes; only behavioural gates the flip
│
└── packages/                      # THE RUNTIME, vendored — you own it
    ├── sor-site                   #   human door: the book + preview/review (A15)
    ├── sor-content                #   agent door: ingest · retrieval · abstain · generations
    ├── sor-gateway-kit            #   fail-closed auth, serve loop, publish
    ├── sor-platform               #   bundles, SHA-pinning, db, contracts
    ├── sor-governance             #   the registers and the ladder
    └── sor-evals                  #   the proof
```

## D2 · What we own

| Repo | Role |
| :--- | :--- |
| **`vertical-system-of-records-framework`** (this) | Apache-2.0. Where the kernel is **developed and published from**, plus the templates `init` materializes and the fixtures the tests run against. |
| `sor-agentfactory` | Becomes **instance #1** — a project of the D1 shape. Its `packages/*` move into the kernel; it stops being the framework's home and starts being its proof. |

Keep **fixtures** (tiny, seconds to build, for tests and `init --minimal`) separate from **templates**
(realistic, what a real builder starts from). eve makes this split and it earns its keep: conflate them
and you get either a test suite too slow to run or a starting point too thin to learn from.

`sor-curriculum` receives `lib/steps.py` and `course_map` **out of** the kernel — that is education, not
framework.

## D2b · The line between `instance.md` and `governance/`

Different concerns, and merging them is a mistake:

> **`instance.md` declares what this *deployment* is and does.**
> **`governance/` declares what is true about the *knowledge*, and who vouched for it.**

Corpus, adapter, database, retrieval floors, budgets, site branding, auth provider and use scope are
instance concerns — the same corpus deployed internally and customer-facing legitimately differs on
all of them. Source register, rights bases, approvals, invariants and coverage are governance, because
those facts are properties of the knowledge and travel with it wherever it goes.

**So the governance level is derived, not declared.** `vsor check` reads what is present and valid
under `governance/` and reports the level achieved — there is no `governance:` key on the instance. A
project that wants to prevent regression pins a floor in `governance/` itself, so the ratchet lives
with the thing it governs.

## D3 · The five minutes, concretely

```
1. vsor init my-sor              one command, the only one
2. "pull in these PDFs"          agent runs add-sources → governed markdown in knowledge/
3. "put it live"                 agent runs deploy → ingest, calibrate, flip, connector live
4. open the preview              see what is in there, what it will refuse, your level
5. "what does it not cover?"     review-coverage → the honest gaps
```

Level 0 the whole way. Governance is what you add on Tuesday, not what blocks you on Monday.

## D4 · The test to apply to every decision below this line

> The design governs artifacts **at rest** and never governs **acts**. Ask of every new decision:
> *which act does this constrain, who performs it, and what row exists afterwards proving they did* —
> not *what field does this add to the register*.
