---
name: implement-spec
description: The discipline for implementing any specs/**/spec.md in this repo — breakdown per aspect, red acceptance first, aggressive self-review, live verification like a human (browser included for site work), the detail pass, and the truth sweep. Load before writing the first line of an implementation.
---

# Implementing a spec

The spec is the contract; this skill is how the contract becomes code without losing anything on the
way. It exists because prose discipline drifts and checklists don't — follow it in order.

## 1 · Breakdown before code

Read the spec twice. Decompose it into **aspects** — every contract clause, every negative promise,
every error slug, every acceptance line is an aspect. Write the list into the working branch's
commit plan. An aspect with no test planned is a hole: fix the plan, not later.

## 2 · Red first

Turn the spec's acceptance into **failing tests before any implementation** — the shell acceptance
verbatim where the spec gives one, unit tests for what it marks unit-tier. Run them; watch them
fail for the *right reason*. The implementation's job is to turn exactly these red lights green —
nothing more. If implementing reveals the acceptance is wrong, **fix the spec in the same commit**
(code wins; supersession visible).

## 3 · Implement in aspect-sized commits

One aspect, its test, its code — smallest change that proves the next assumption. Never batch five
aspects into one commit; review dies there.

## 4 · Aggressive self-review before declaring anything

Before "done", attack your own work the way this repo attacks specs:

- **Re-read the spec clause by clause** against the diff — every clause either has a passing test or
  a written reason it can't.
- **Hostile pass:** what did I not handle — interruption, empty input, weird names, missing binary,
  no network, wrong platform? The spec's error slugs are the map; every slug must be reachable and
  tested.
- For anything non-trivial, run the repo's adversarial pattern: independent reviewers with distinct
  lenses (`/code-review` at high effort, or spawn review agents). **Findings get fixed or recorded —
  never quietly dropped.**

## 5 · Live verification — like a human

Tests prove clauses; only *running the thing* proves the product. Before done:

- **Walk the real path by hand or by driving the real CLI**: the actual command a user runs, on a
  clean directory, timed. Read the actual output — is the error's remedy real? Is the handoff next
  step correct *right now*?
- **For anything with a page: open it.** Build the fixture site, serve it, and verify in a real
  browser context (playwright when available; curl + DOM assertions minimum): the page renders, the
  title is right, the css token actually applies, **dark and light both**, zero console errors,
  zero failed/external network requests, click the nav, run a search. The upstream flat-layout bug
  *shipped* because nobody loaded the page — that class of failure is yours to prevent.
- **Record what the live run taught** beside the code (`found live: …` comments) — upstream's
  convention, and the reason its scars don't repeat.

## 6 · The detail pass

Detail is the product. Before done: every error carries its remedy · every printed path is real ·
`--json` envelopes (where they exist) are complete and stable · empty states and first-run output
read as designed · measured constants carry date and method · no present-tense claims about
unbuilt behavior anywhere in the diff.

## 7 · Truth sweep and gate

Any document the change made false is corrected **in the same commit** (README, AGENTS.md,
status.md, the spec itself). Then `make gate` — and for release-tagged work, the strict profile
where a skip is a failure. Done means: acceptance green on a clean machine, docs true, findings
resolved or recorded.

## The rule under all of it

If you cannot tell whether you are done, you skipped step 2. If you are sure you are done but
haven't run it, you skipped step 5 — and that's the step that catches what everything else misses.
