> **ARCHIVED — not authoritative, not in the reading order.**
> Frozen research artifact from 2026-08-11. Kept because the reasoning is real work and the
> citations are load-bearing. Superseded for all live purposes by `AGENTS.md`, `docs/spec.md`
> and `docs/decisions.md`. Anything here stated in the present tense describes a system that
> **did not exist** when it was written.

---

# Gaps register

What the design has **not** addressed. Produced 2026-08-11 by eight independent review lenses
(rights/legal, corpus onboarding, expert authoring, ops/economics, identity/tenancy, change
propagation, quality/scale, market/adoption) reading the design *and the code*, yielding 133 raw
findings deduped and ranked to 12.

Ranked by **(cost of discovering late) × (likelihood it bites)** — not by severity label. Convergence
across lenses pushes rank up; it is the strongest signal in the set.

**Kind:** `unknown-unknown` = the design shows no awareness this is even a question ·
`known-but-unanswered` = named but unresolved · `answered-but-unverified` = an assumption stated as fact.

---

## The blind-spot pattern

Worth more than any individual entry, because it predicts the *next* gap:

> **The design governs artifacts at rest and never governs acts.** Every register specifies what a
> thing **is** — its rights basis, its class, its coverage, its provenance — and not one describes
> what may be **done** with it, by whom, to whom, on what clock, and what the system records when
> they do. So rights are checked at ingest but not at serving or egress; approval attaches to the
> corpus but not to an answer; audit stores a hash but cannot replay a read; abstention is a property
> of the server that never reaches the human; jurisdiction is modelled for content but not for data;
> and takedown suppresses a row but never deletes anything.
>
> **The corrective:** test the next design decision by asking *"which act does this constrain, who
> performs it, and what row exists afterwards proving they did"* — rather than *"what field does this
> add to the register."*

## The thing every lens missed

> **Provenance is not correctness, and the design treats them as identical.** Every mechanism —
> source register, approval gate, citation contract, coverage register, calibrated abstention —
> proves *who said something and when*. None can express that what was said is **contested, a
> minority position, superseded by professional consensus the corpus does not contain, or simply
> wrong.** Invariant 4 preserves conflict between two registered *sources*; there is no way to record
> dissent *about* a source, no second-opinion or peer-review class, no confidence-in-the-rule as
> distinct from confidence-in-the-retrieval, and no appeal path when the expert is both the ground
> truth and the error.
>
> Because the twin's licensable value is judgment *beyond* the text, **the commercial surface is
> precisely the ungoverned part** — and the governance stack's net effect is to authenticate one
> credentialed person's view so persuasively that a reader cannot distinguish it from settled
> authority. That is simultaneously the product's ceiling, its sharpest liability shape, and the
> first objection a professional body will raise.

---

## The twelve

### 1. The rights model stops at ingest — no serving mode, no egress rule, no instrument
`critical` · `known-but-unanswered` · lenses: rights-legal, corpus-onboarding

The design requires a rights basis on every source and makes it a gate, but never asks **what a
rights basis permits**. Four structural consequences: (a) **there is no serving mode below verbatim**
— `chunks.content` stores full text, byte-exactness is a *tested invariant*, so a source licensed for
citation but not reproduction (IFRS, FASB Codification, ISO, most publisher and bar materials) can
only be ingested wholesale or omitted, and the tested byte-exactness defeats any argument that the
store is a transformative index; (b) **there is no egress rule** — the BYO-model economics mean every
read result is transmitted into a third party's model context, which is exactly what licensed corpora
forbid; (c) `rights_basis` would be free text with no enumerated vocabulary, no executed instrument,
no counterparty, no territory, no term end — and the live instance already shows the failure mode,
with entries parked as `PENDING — OWNER DECISION` **so the gate ships green**; (d) termination has no
wind-down — the denylist is serving-time suppression with no rights-holder key and no reach into the
site, `llms.txt`, skills or bundle doors.

**First move:** make `rights_basis` a reference to `governance/agreements/<id>.yaml` carrying
counterparty, instrument, execution date, territory, `term_end`, and an **enumerated** `permitted_uses`
(ingest / embed / serve-verbatim / serve-bounded-quote / serve-locator-only / transmit-to-third-party-model
/ sublicense-to-customer). Add `serving_mode` to the source register and implement locator-only now,
while it is one predicate on the read path. A vocabulary decision — an afternoon before the register
exists, a re-ingest after.

### 2. Jurisdiction, effective date and supersession are absent — and the abstain gate is blind to scope
`critical` · `known-but-unanswered` · **5 of 8 lenses converged**

The strongest signal in the set. The design names the register gap and treats it as deferred — but
none of the evidence is about a missing register. **Three mechanisms each independently foreclose the
fix.** *Retrieval:* the abstain gate is one scalar cosine against one global floor, and cosine has no
jurisdiction axis — an IFRS-shaped question against a US-GAAP corpus embeds squarely inside the corpus
vocabulary and scores far above any floor, so **wrong-jurisdiction is unpassable by construction** and
can only be faked. The out-of-corpus probes it was calibrated against are far-domain ("best pizza place
near me"); **not one scope-adjacent probe exists.** *Serving:* exactly one generation is active and
`stable_id` is unique per generation, so old-rule-and-new-rule-both-in-force — the most common
professional conflict, which is temporal — **cannot be represented**. *Ingest:* nothing detects that a
standards body revised, the refresh gate is your own git SHA, and "effective" and "published" are
conflated, so a nightly refresh serves a rule the moment it is written up, before it commences.

**First move:** add `jurisdiction`, `effective_from/to`, `publisher`, `source_version` as columns in
the same pass as the FTS-language field; add an `as_of` argument to search and read defaulting to
today; make the abstain gate a **conjunction** (cosine floor AND declared-scope match). Make
scope-adjacent OOC probes mandatory for calibration.

### 3. The v0.1 acceptance test cannot be executed
`critical` · `answered-but-unverified` · lenses: corpus-onboarding, market-adoption

The second instance is called "not negotiable" — it is the only thing converting an
application-with-a-config-file into a kernel. **Both its prerequisites are missing and neither is
acknowledged.** The claim that a PDF corpus is "a third adapter, not a fork" is **false**: both
adapters take *finished markdown on disk*, and there is zero conversion tooling anywhere. So
PDF→markdown happens upstream of the adapter, in a stage with no package, no CLI verb, no config
surface and **no home in the repo shape** — built in a scratch directory, then rebuilt for the third
vertical. The consequences chain: provenance starts at the *converted* markdown, so an OCR error in a
rate table is byte-indistinguishable from authored content and ships with full register authority;
conversion is not byte-idempotent, which **breaks the `chunk_hash` carry-forward the entire cost model
rests on**; and no extraction-fidelity gate exists, so a 15% garbled corpus passes an eval suite whose
gold queries hit the other 85%. Separately, the moat vertical is gated on written licensing answers
from standards bodies, with no deadline and no fallback corpus.

**Discovered:** week six of extraction, when the doors are done and there is no second corpus — by
which point every seam has hardened around Docusaurus, the exact failure the acceptance test exists to
prevent.

### 4. The stated differentiator — auditor replay — does not exist, and three mechanisms prevent it
`critical` · 4 lenses

"Reconstruct which version of which source, approved by whom, produced a given answer" is named as
*the* differentiator. Three independent blockers: (a) **`GC_GRACE` is 40 minutes** and reap issues real
DELETEs against `sources`, `content_nodes`, `slug_aliases` and `node_centroids` while not touching the
audit log — so a six-month-old audit row citing a `content_hash` points at text that **no longer
exists**; roughly two nights of history exist at any moment. (b) `retrieval_log` is FORCE RLS with
exactly one policy — INSERT — and no SELECT policy and no role that can read it, so **the audit ledger
is write-only in production**. (c) `takedown_denylist` has a SELECT policy and grants but **no write
policy, no write grant, and no CLI** — the rights-holder removal lever is enforced on every query arm
and **cannot be pulled**.

**First move:** split *reaping* from *forgetting* — an append-only `chunk_archive` written at ingest
and never reaped, plus a per-generation manifest row. Add an auditor role with tenant-scoped SELECT,
and an ops write policy on the denylist. Then write `vsor replay --audit-id` **even as a stub**: it is
the acceptance test for whether the differentiator exists at all.

### 5. Approval is invariant 8, and there is no approval object, approver, unit or record
`critical` · 3 lenses

No `approved_by`, `approved_at` or scope anywhere in schema, manifest, instance contract or bundle.
Today the mechanism is a merge to main plus a timer at 03:32 UTC, with a bot as one commit author.
Four sub-gaps: **no unit** — "approve the corpus" is either one button on a 399-file diff nobody can
read (governance theatre) or 399 review acts per release (the expert quits after release two); **no
person** — there is identity for readers and learners but none for authors or approvers, so the
engineer's approval is indistinguishable from the expert's, destroying the audit story exactly where
it matters. The serving half is **already built and unused** (`content_nodes.status` CHECK
published/draft/archived, filtered on every read, never written to), and the only human-review UI in
either repo is on the discard list.

**First move:** make approval a **row, not a state**, keyed on `(source_id, content_hash, approver,
date, scope)` — with the content hash as subject, so an edit un-approves exactly the pages it touched
and review burden is proportional to the **diff**, not the corpus. Ingest writes `status='draft'` when
a source's current hash lacks an approval row, and the existing serving filter enforces invariant 8 for
free. Add an `authored_by` class (human / agent-drafted-human-approved / agent-generated) in the same
column set.

### 6. The 80/20 commercial model has no mechanism — and the design states twice that it does
`critical` · 4 lenses

Two assertions in the design are **not true of the code**: "multi-corpus is already `corpus_id`" — the
four content tables have **no `corpus_id` column**; and "extensions-with-override is the mechanism" —
that is a TypeScript primitive with **no Python analogue**. Uniqueness is `(tenant_id, generation,
stable_id)` and every retrieval arm filters on tenant+generation only, so a second corpus in the same
tenant **collides** on stable_id, root slug and the shared generation counter — and a separate tenant
is worse, because a read binds exactly one `app.tenant_id` per transaction, so **no single statement
can see base plus overlay**. Composition would move to Python across two transactions, breaking RRF
fusion, the calibrated floor, `top_vec_sim`, the HMAC snapshot token and precedence.

**Discovered:** week one of the first customer engagement, because **customization is the sale** — and
the only available answer is a fork, the exact failure the 80/20 model indicts bespoke software for.

**First move:** add `corpus_id` to the four content tables and every arm predicate **now**, while
there is one corpus at one generation to migrate; make the read path take an ordered list of corpora
with a precedence rank so a customer row shadows a vertical row and **both citations return**. Prove
the behaviour seam with one worked override case.

### 7. The correctness apparatus measures retrieval, not correctness
`critical` · 5 lenses

"Evals are the correctness story" is stated flatly. They are not — they are a regression suite whose
**gold cases are generated from the corpus being tested** (the prompt is literally *"write one question
which the following passage answers"*), so **a wrong rule generates a gold question whose correct
answer is that wrong rule, and the gate certifies the defect.** Compounding: gold rows assert only that
a slug *ranks* — there is no assertion kind saying "must still say $500,000" or "must cite source X
version 2026-03" — so a revision changing a number while keeping the slug **flips to production
silently and passes every gate**. Five of the six mandated eval classes are not mechanizable at all
today. The failure mode is that **everything goes green.**

**First move:** split evals into three classes and be explicit about which gates. *Behavioural*
assertions pinning no content identity (abstains out-of-corpus, cites a registered source, never cites
orientation, preserves conflict) **gate the flip**; slug-pinning relevance sets are generated and
**reported, not gating**; *externally authored* correctness cases are a **ratchet whose baseline may
only grow**, required non-zero per outcome and signed by the named expert. Add `must_contain` /
`must_cite` as a second assertion kind. Record `calibrated_at_chunk_count` beside `vector_floor` and
fail `vsor check` when it drifts. Make the degraded path **fail closed**.

### 8. Nothing v0.1 plans to publish has a licence permitting it — including the expert's digital replica
`critical` · `unknown-unknown` · lenses: market-adoption, rights-legal

**Verified 2026-08-11.** `ag2/LICENSE` reads *"PROPRIETARY AND CONFIDENTIAL … exclusive property of
Panaversity"* and expressly enumerates the asset classes the framework plans to ship — source code,
documentation, educational content, lesson materials, specifications, associated assets.
**`sor-agentfactory` has no LICENSE at all**, which under default copyright is all rights reserved.
No relicensing resolution exists; no contributor assignment or DCO/CLA covers the people who wrote the
files. This is the **cheapest item on the list to fix and one of the hardest to fix late** — a
relicensing negotiation after packages are on PyPI, or a right-of-publicity claim after a persona
ships. It also blocks the design's own entry path: an FDE's counsel cannot approve a dependency with no
LICENSE and a private source repo.

Separately: `ziakhanpersona.md` is a **digital replica of a named individual** carrying credentials,
employers and biography, with 119+ versioned instances in production — and the design proposes
generalizing it into a **licensable pack**. There is no persona licence anywhere, and the design never
enumerates what one must contain (scope of voice and likeness, permitted verticals, sublicensing to the
FDE's customers, term, termination effect on already-shipped packs, post-mortem rights, approval over
new versions). Digital-replica statutes make an unlicensed commercial replica directly actionable.

**First move:** commit `LICENSE` (Apache-2.0, kernel code), `LICENSE-CONTENT` (per-corpus,
owner-chosen), and a signed relicensing resolution covering the specific extracted paths — plus a
LICENSE in `sor-agentfactory` today regardless. Then write the persona-licence template as a governance
artifact, and make `identity/identity.md` unloadable without a pointer to an in-term agreement.

> ✅ **Partly resolved 2026-08-11 — and the recommendation was refined in the doing.** `LICENSE`
> (Apache-2.0) is committed. **No `LICENSE-CONTENT`:** the framework ships schemas and *executable*
> prose, not a body of knowledge, so a second licence would create an audit question with no good
> answer — the code/content split belongs to a *vertical*, where the rights basis on each registered
> source already handles it (decision A12). And because `vsor init` now scaffolds into the user's own
> repo, a vertical's corpus is licensed by whoever owns that repo, which is the same person who owns
> the knowledge. Still outstanding: the relicensing statement, the third-party-contributor and
> vendored-attribution check, and the persona-licence template.

### 9. Identity is a deployment constant; there is no authorization model; public doors leak private source
`critical` · `unknown-unknown` · lenses: identity-tenancy, market-adoption

Identity appears nowhere in the design — not in the package table, not in the seven readers, not in
v0.1 scope, and there is no visibility concept in the compiler diagram. Auth config holds **one**
`sso_url` with a vendor-specific JWKS path and RS256 hardcoded — no OIDC discovery, no per-instance
auth block — so a firm on Entra or Okta cannot be onboarded without editing the kernel, violating the
framework's own law. **Authentication exists; authorization does not:** scopes are empty with the
comment that any valid token from our SSO is accepted, no group/role/clearance claim survives, and
content has no ACL — so *"engagement team A cannot read team B's files"* is **inexpressible**, which
for accounting and law is table stakes and often regulatory. The tenant claim is decoded then
discarded, so each new customer needs a hand-registered OAuth client plus an SSO redeploy — making
customer *N*'s onboarding a change window for customers 1..*N*-1. And **the compiler's headline feature
is the leak vector**: only the MCP door has an access model, so a customer's escalation thresholds and
fee logic compile to an indexed public site plus `llms-full.txt` beside a carefully gated connector.

**Discovered:** the first customer security review — which happens *before* any contract is signed.

### 10. There is no liability, disclaimer or regulatory-classification surface — and the persona doctrine forbids one
`critical` · `unknown-unknown` · lens: rights-legal

The design targets accounting, law and medicine and mentions liability, indemnity, disclaimer,
professional advice, regulator and the EU AI Act **zero times**. Grepping the code returns nothing but
persona lines saying the opposite: the shipped persona instructs *"No disclaimer, no account of your
own architecture"* — a doctrine the design proposes to inherit wholesale into generalized instruction
packs. There is no `use_scope` or disclaimer field on the instance contract and no scope statement in
any tool description. The obvious verticals sit in EU AI Act **Annex III** (education and evaluation of
learning outcomes — the tutor plus learner records is arguably already in scope; administration of
justice; creditworthiness; employment), whose obligations applied from **2 August 2026**, and Art. 50
requires AI disclosure that the persona doctrine actively contradicts. Two second-order traps: the
white-label mechanism means a customer putting their name on the system becomes the **legal provider**
and inherits the full obligation set without being told; and **AICPA independence** — an FDE-built
Worker performing bookkeeping-adjacent functions for an audit client impairs the customer firm's
independence, which becomes *their* finding, caused by *your* product, discovered in *their* peer
review.

Compounding all of it: **abstention is invisible downstream** — the server can decline, but nothing
makes the client surface that to the human, so the most likely harmful path is a confident ungrounded
answer in the expert's persona carrying the corpus's borrowed credibility.

**First move:** add a required `regulatory` + `use_scope` + `disclaimer` block the check refuses to
leave blank, and override the no-disclaimer persona line for any non-education vertical. Then map the
existing governance artifacts to Annex IV headings — the source register, coverage register, eval
suite, calibrated abstention and retrieval ledger **already constitute most of a technical file**, so
emitting an Annex IV-shaped dossier converts the largest compliance cost into the product's strongest
differentiator. *(Legal characterizations here need counsel, not a code review.)*

### 11. The expert's write door does not exist
`high` · `answered-but-unverified` · lens: expert-authoring

The design names the non-terminal domain expert as "the hardest constraint in the whole design," then
gives the compiler **six output doors and zero input doors**, and assigns that reader "CLI + CI gates
+ review UI" — the terminal the promise forbids, plus a UI that does not exist. Reality: contributing
requires git, Node, pnpm, Python and uv before touching a word; the corpus lives inside a Docusaurus
app inside a **private 10-app monorepo** that also holds SSO and billing services, whose licence states
contributions become Panaversity's exclusive property — so handing an accountant edit rights to *their
own licensed corpus* means granting commit access to seven production services, **and you cannot
license content separately from code or hand the corpus back to its owner**, all three of which the
rights-basis register exists to promise. `editUrl` is `undefined` at seven call sites. Content PRs run
**no build at all**, so there is no preview to review; nothing renders a page as the *agent* sees it,
and the pipeline can silently make prose unretrievable; and rejections have no destination, so the same
disputed sentence returns next release.

**First move:** decide the write door **before** the site package boundary is drawn — "the site is also
the editor" and "the site is a read-only door" are different packages. Add it as a seventh door so it
survives extraction. Ship a per-source *"what the agent sees"* report as check output — it is a query
over data the pipeline already produces.

### 12. Every fix on this list is a schema change, and there is no migration runner
`high` · `known-but-unanswered` · lens: change-propagation

The multiplier on all eleven above. Jurisdiction columns, effective dates, `corpus_id`, approval rows,
clearance labels, origin-artifact provenance, chunk archive, new audit actions — **every one is DDL
against a live database** holding a corpus, a learner record and an audit ledger you must not drop. The
schema opens by declaring no migration runner; bootstrap refuses a non-empty DB; `schema_meta` is
written and read by nothing; and `retrieval_log.action` is a closed CHECK whose bad values **abort the
wrapping transaction** rather than rejecting the row — which is exactly why the rollback path has never
worked. The design reasons carefully about migration cost for **one** field and never generalizes it to
the governance layer the same document commits to building. "No legacy fallback logic" has already
failed at one instance and one tenant: a retired key survives as an accept-and-ignore shim because the
strict binder would otherwise crash both gateways at boot. With *N* customer instances pinned to *N*
bundles, shim count grows monotonically and a kernel upgrade's failure mode is a **fleet-wide boot
crash**.

**First move:** write the compatibility contract as a page of policy (the deployed artifact is the
bundle, not the repo; unknown keys warn-and-ignore within a major; retired keys honoured for one minor;
capability removal needs a deprecation release), adopt expand/contract migrations with a runner —
`sor-learning` **already has numbered migrations**, lift that pattern up rather than inventing one —
and make composition read `schema_meta` and fail closed with a named remedy. Move the frozen wire
baseline into the instance directory and stamp a `wire_version`. Replace the closed CHECK with a seeded
lookup table in the same pass.
