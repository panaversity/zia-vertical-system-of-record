> **ARCHIVED — not authoritative, not in the reading order.**
> Frozen research artifact from 2026-08-11. Kept because the reasoning is real work and the
> citations are load-bearing. Superseded for all live purposes by `AGENTS.md`, `docs/spec.md`
> and `docs/decisions.md`. Anything here stated in the present tense describes a system that
> **did not exist** when it was written.

---

# Claims register

Every external claim this design leans on, verified 2026-08-11, with the caveat that must travel
with it. Written because a framework whose product is *provenance* cannot cite unverified numbers.

**Rule:** never quote a figure from this file without the caveat recorded beside it.

---

## Confirmed, quote freely with the caveat

| Claim | Verdict | The caveat that must travel with it |
| :--- | :--- | :--- |
| **GitBook: AI agents were 51.8% of intentional docs reads by late April 2026** (humans 48.2%), up from <10% in Jan 2025 | ✅ Exact | One vendor, **one week** (27 Apr–3 May 2026), and the 51.8% comes from *excluding* crawler buckets — a definitional choice doing real work. From 61.2M pageviews: humans 36.2%, agents 38.9%, crawlers 24.1%. **ChatGPT alone is 54% of that agent traffic and Meta AI 12.4%, while coding agents are under 7%** — so this is chatbot-mediated human reading, not autonomous agents. ~22% of agent traffic is unidentified. |
| **Mintlify: 66% agent share of measured docs traffic, July 2026** — 213M agent requests vs 105M human page loads; 15.2% at the start of 2026 | ✅ Exact | Apples-to-oranges units: agent **requests** vs human **page loads**, and one agent task fires many requests, so 66% overstates agent share of *tasks*. The "nearly 90% by year-end" is an explicit trend extrapolation, not a forecast. Not comparable to GitBook's 51.8% — different denominator. |
| **83.7% of agent docs events arrive via an explicit machine route** | ✅ Exact | **This is a Mintlify figure, not GitBook's** — do not blend it into the GitBook paragraph. Mintlify warns that adding machine routes mechanically raises this number. |
| **Direct `.md` requests went 25.1% (Feb 2026) → 54.4% (Jul 2026)** | ✅ Exact | Also Mintlify, not GitBook. July is a **partial month** at publication. Supply-side: Mintlify was actively shipping and promoting these routes. |
| **MCP docs-server call mix ≈ 57% search / 43% read** | ✅ Exact | 56.57% / 43.30% / 0.13% feedback. Mintlify-hosted servers only, reflecting Mintlify's own tool surface. MCP calls carry no conversation identifier, so this is call-volume ratio — **you cannot infer a per-task search:read ratio**. |
| **shadcn registry mechanics**: `registry.json` + per-item manifests, namespaced registries (`@acme/button`), private registries via `Authorization: Bearer ${TOKEN}`, and an MCP server for natural-language install | ✅ All four | **Dating correction: CLI 3.0 shipped August 2025, not 2026.** Current and live, just a year older than assumed. Explicitly decentralized — no central registrar. |
| **Cloudflare: from 15 Sep 2026, "Agent" and "Training" crawler categories blocked by default** | ✅ Exact wording | Two scope conditions, and omitting either overstates it: **new domains onboarding only** (not the existing base), and **only on pages that display ads**. Existing customers can opt out beforehand. Side effect: blocking Training also blocks multi-purpose crawlers like Googlebot and Applebot even when Search is allowed. |
| **MCP Registry: DNS-verified reverse-domain namespaces** | ✅ Confirmed | **Status is PREVIEW, not GA** — the docs carry an explicit breaking-changes banner. And it **explicitly does not support private servers**; a paid corpus means running your own registry. |
| **Google OKF exists** — markdown + frontmatter bundles, one concept per file, optional `index.md`, `log.md` history | ✅ Confirmed, now v0.2 | v0.2 adds provenance, trust and lifecycle frontmatter families — directly relevant to a governance argument. **No named third-party adopter as of Aug 2026**; "ones to watch" commentary is speculation. Do not confuse with Open Semantic Interchange, a separate and much more broadly backed initiative. |
| **Vercel eve dogfood: 100+ internal production agents, 92% autonomous ticket resolution, ~29% of deployments agent-triggered** | ✅ Verbatim in the launch post | Self-reported and unaudited, with no definition of "in production" or "solved on its own" — no escalation, reopen or CSAT rates behind the 92%. Secondary coverage reporting ">50% of deployments" conflicts with Vercel's own ~29%; cite the primary. |

## Overstated — rewrite before using

| Claim | Verdict | What is actually true |
| :--- | :--- | :--- |
| **"No public example of a governed professional body of knowledge served over MCP with grounding guarantees"** | ⚠️ **Does not survive** | **Thomson Reuters CoCounsel Legal MCP** (with Anthropic, May 2026, now GA) serves Westlaw + Practical Law — ~1.9B documents, 1.4B KeyCite validity signals — over MCP, jurisdiction-aware, with a patent-pending citation ledger. **Rewrite as:** no public example of a governed professional **curriculum** served over MCP with an **explicit abstention guarantee**, instantiable as a kernel — and name CoCounsel first. Three separations survive: it commits to citation traceability, not to declining when sources are insufficient; it is a research corpus, not a curriculum; it is a publisher's sealed product, not a kernel. Everything else surveyed fails on governance, not capability (the NCCN server is an unofficial PDF-scraper; the OpenEvidence server is explicitly unofficial; **no official MCP server exists from AICPA, CFA Institute, ACCA, any bar association, the WHO or the CDC**). Servers with real abstention semantics carry no professional corpus — **abstention and governed professional knowledge are so far disjoint sets.** |
| **"Skills raised agent success by ~26 points on Netlify's evals"** | ⚠️ Misdescribed | Real number, wrong unit. It is an average lift in the **AXIS composite score** (0–100 across goal achievement, service, environment and agent), **not a task success rate**. Sample is **12 runs** (3 scenarios × 2 agents × 2 conditions), and it is a vendor self-evaluation of the vendor's own product. Safe phrasing: *"in Netlify's own 12-run AXIS pilot, adding skills lifted the composite agent-experience score by an average of 26 points."* |
| **"The first community question about eve was lock-in"** | ⚠️ Partly unverifiable | Three of four sub-claims hold and are stronger than stated: HN traction was near zero (**max 9 points, 0 comments** across six submissions) despite heavy press; a reviewer did hit a forced Vercel login (single report, hedged by the reviewer as possibly an early bug); reviewers did rule it out for self-hosters. **"First" is unsupported** — lock-in was a dominant theme, but no source establishes ordering. Drop the word. |
| **"Over 60% of vercel.com pageviews are agents"** | ⚠️ Weakest source | A verbal, off-the-cuff remark by Vercel's CTO on a podcast (~Apr 2026), seven-day window, no published methodology, no bot-classification disclosure, no primary post located. **Treat as an executive anecdote, not a measurement.** Better-sourced Vercel figures exist but measure different things. |

---

## Code claims — checked against the repos, not inferred

The independent research draft stated plainly that its repo claims were *"inferred, not inspected."*
They were then inspected. Results:

| Claim | Verdict | Ground truth |
| :--- | :--- | :--- |
| `gateways/sor-content` holds the agent door's substance | ❌ **Wrong** | 238 lines total, 111 source. The machinery is in `packages/sor-content` (~7,300 lines). |
| Build-time checks enforce the authority/orientation boundary | ❌ **Wrong** | **No such validator exists in either repo.** This is the design's most load-bearing assumption and it is entirely unbuilt. |
| The registers exist as structured data | ❌ **Wrong** | None of the seven exist anywhere. |
| Reflexes and the map exist in `SKILL.md` format | ❌ **Wrong** | Not present. |
| Every returned chunk carries stable ID, authority kind, version, canonical URL | ⚠️ **Two of four** | `stable_id` ✅ via a provenance block on every hit; canonical URL ✅ but conditional on sitemap confirmation; "version" is **only the corpus rebuild generation** — no source version, no effective period; **authority kind does not exist anywhere.** Nothing lets an auditor say *which edition of which rule answered.* |
| The site emits `llms.txt`, `llms-full.txt`, per-page `.md`, sitemap | ⚠️ **Two of four** | `llms.txt` exists but is a **hand-maintained 154-line static file with no generator**, so it rots as the sidebar changes. `llms-full.txt` and per-page `.md` twins **do not exist** — and ~265 lines of HTML scraping exist in the ingest path *solely* because of that. Sitemap ✅ (Docusaurus preset). |
| Ingestion re-reads on every publish so it "never drifts from the source" | ⚠️ **Overstated** | Component-shell pages are read from whatever is **live** on the deployed site, so provenance is "whatever was up at publish time." A config-only change re-ingests nothing unless a human sets `FORCE=1`. The instance file already names the hermetic fix. |
| An `evals/` plane with golden sets and CI gates | ⚠️ **Partial** | `sor-evals` is the **largest package** (~14,400 lines) with real ratified gold sets and a documented metric law. But there are **no CI gates** — the actual gate is a nightly *release* gate in `refresh-sor.sh`, and the stronger 111-query measure gate is **off by default**. Coverage is retrieval quality and tutor voice: roughly **2 of the method's 6 mandated case classes**; no conflicting, wrong-jurisdiction, escalation or forbidden class exists. |
| Per-user records with an explicit save contract | ✅ **Confirmed** | `sor-learning`, ~5,000 lines. Identity is injected from the verified bearer and is **never a tool argument**; both record tools are declared writes with the reasoning recorded; content stays blind through opaque callbacks. The cleanest seam in the system. |
| FTS language configurable, defaulting to English | ❌ **Wrong — hardcoded** | Six literal sites, no instance field, a **strict** frontmatter binder that rejects unknown keys, raw-SQL schema application with no templating, and a test pinning the literal. See `extraction-sor-content.md` §2. |
| Embed model configurable per instance | ❌ **Fixed in the image** | Deliberately, on the documented eval-locked side of the line. The serve-time drift check compares one string and is **alerting-only, not fail-closed**. |
