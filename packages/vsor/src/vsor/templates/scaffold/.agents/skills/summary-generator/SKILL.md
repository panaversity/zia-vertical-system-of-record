---
name: summary-generator
description: Write the short "in short" opening that tells a reader within fifteen seconds what a corpus document decides, who it applies to and when it is true — extracted from the document, asserting nothing the body does not. Use after a document is written or converted, and when reviewing one that buries its answer.
---

# Summaries

Most readers arrive at a document from a search result, mid-corpus, needing to know one thing:
*does this page answer my question, and what does it say?* The summary is the answer to that. It is
the most-read text in the corpus and, for that reason, the most dangerous place to be imprecise.

## Where it goes

**Inside the document**, directly under the `#` heading, before the first section — three to six
lines, then the body.

Not in a separate file. A second markdown file under `knowledge/` becomes its own page, its own
search result and its own citable copy of the same claims. Two copies of a rule is one rule and one
future contradiction; the corpus keeps one.

## Extract before you write

Answer these against the document. If an answer is not in the document, that is a finding for the
owner — never a blank for you to fill.

1. **The one thing.** If a reader remembers a single sentence from this page tomorrow, what must it
   be? Usually the rule, not the topic.
2. **What it actually decides.** The rule, the threshold, the period, the obligation — in the
   document's own values.
3. **Who and what it covers**, and — just as important — what it does not. Scope is the fastest way
   a reader knows they are in the wrong document.
4. **When it is true.** The version, effective date, or "as at". A summary with no time on a rule
   that has one is a trap.
5. **What changes the answer.** The exception, the hold, the condition — named, not described.
6. **Where to go next.** The one or two documents a reader on this page usually needs after it.

## The shape

```markdown
# Retention periods

**In short.** Class A records are kept seven years from termination; Class B, three years from
creation. A litigation hold suspends destruction entirely until it lifts. Applies to records
created on or after 1 January 2019 — earlier records are not covered by this policy.
Source: retention policy §14, as at the 2024 revision.
```

Prose or a short bullet list, whichever the document's shape calls for. Length follows the
document: a single-rule page needs two sentences; a page with three classes and two exceptions
needs five or six lines. Past that, it is a second copy of the document, which is the failure mode
this whole file exists to prevent.

## The rules that make it safe

- **A summary asserts nothing the body does not.** Every claim in it appears below, with the same
  number, the same unit, and the same qualifier. Not "about seven years". Not "generally kept".
- **Qualifiers survive compression.** If a rule has an exception big enough that a reader acting on
  the summary alone would get it wrong, the exception belongs in the summary. Compression that
  drops a condition has not summarised the rule, it has replaced it with a different one.
- **Say the answer, do not describe it.** "This section explains the retention rules" tells the
  reader nothing they did not get from the title.
- **No new synthesis.** Combining two rules into a neat generalisation is authoring, not
  summarising — and the generalisation is exactly the kind of claim nobody sourced.
- **No fluff.** No "importantly", no "as we will see", no closing encouragement.

## Verify

Read the summary alone, as someone who will act on it and never scroll. Then:

- [ ] Every claim traced to a line in the body
- [ ] Every figure, unit and date identical to the body's
- [ ] Every load-bearing qualifier present
- [ ] Scope stated; the "as at" stated if the body has one
- [ ] Nothing asserted that the body does not assert
- [ ] It reads as an answer, not as a description of an answer

If acting on the summary alone would lead a reader somewhere the full document would not, it is
wrong. Fix it, or make it shorter until it is only what you can defend.
