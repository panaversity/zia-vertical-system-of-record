---
name: technical-clarity
description: Review a corpus document for the things that make expert prose unreadable to the person who actually needs it — undefined jargon, gatekeeping language, abstraction before example, assumed context, and inaccessible formatting — without ever trading away precision. Use after writing or converting a document, before the owner reviews it.
---

# Clarity review

A system of record is read under pressure by someone who is not the person who wrote it. Expert
prose fails them in predictable, fixable ways — and the failure is invisible to the author, because
the author has the context that makes it read fine.

Your job here is to hold two things at once: the document must be readable by its actual audience,
**and every load-bearing word must stay exactly as precise as it was**. Simplification that
softens a rule is not a clarity fix. It is a correctness bug with better rhythm.

## The one rule that governs the rest

**Clarity is never bought with precision.** When a term is technical because the thing is
technical — a statutory phrase, a defined term, a threshold with a unit — the fix is to keep the
term and define it, never to swap it for an approximation. "Reasonable endeavours" does not become
"try hard". "Within 30 days of service" does not become "within a month".

If a review note would change what the document asserts, it is not a clarity note. Stop and take
it to the owner as a content question.

## Read the document twice

**First pass — as the intended reader.** Who is going to open this, under what pressure, knowing
what? A specialist checking a threshold and a newcomer trying to understand the whole area need
different things from the same page. Decide which one this document is for; a document written for
both is usually written for neither.

**Second pass — as the auditor.** Now go looking for the five failures below.

## 1 · Gatekeeping language

If a phrase makes a reader feel stupid for not already knowing, cut it. These words carry no
information and cost credibility:

- **Minimisers**: obviously · clearly · simply · just · trivially · merely · of course
- **Assumptive**: everyone knows · as you know · naturally · needless to say
- **Dismissive**: it's easy · anyone can · straightforward · quickly

They are also a reliable smell for a missing explanation — "obviously" tends to sit exactly where
the reasoning was skipped.

> "Obviously the exemption applies." → "The exemption applies, because the entity is below the
> threshold in §4(2)."

## 2 · Undefined terms

Define a term the first time the document uses it, even a term the author considers common. The
reader arrives on this page from a search result, not from page one.

- Definition on first use, inline, in the sentence that needs it.
- A term defined in another document gets a link, not a second definition — two definitions of the
  same term in one corpus is a contradiction waiting to be found by a reader.
- Watch the density: more than two or three unfamiliar terms in a paragraph and the reader is
  translating instead of reading.
- **Acronyms in full on first use**, every document, no exceptions. Documents are read alone.

## 3 · Abstraction before example

Rules are understood faster after a concrete instance than before one. Where a document states a
principle and never shows it landing on a case, it will be misapplied.

> **Weak**: "Retention periods vary by record class."
> **Better**: "Retention periods vary by record class: a signed contract is kept for 7 years after
> termination; a draft is destroyed at signature."

One good example beats three; three examples of the same shape teach nothing the first did not.

## 4 · Assumed context

Make implicit context explicit — this is where expert documents fail hardest, because the context
is invisible to the person who has it.

| Missing | Looks like | Fix |
| :--- | :--- | :--- |
| **Scope** | a rule with no "applies to" | say who and what it governs |
| **Time** | a rule with no version or date | say as at when it is true |
| **Motivation** | a procedure with no reason | one sentence on what it protects against |
| **Boundary** | a rule that reads as absolute | say where it stops and what governs beyond |
| **Reference** | "as discussed above", "see the policy" | name the document; link it |

## 5 · Formatting that excludes

- **Images carry alt text** that states what the image says, not what it is ("Approval flow:
  requests above $50k route to the finance director" — not "flowchart").
- **Colour is never the only signal**; a table that means something by red rows means nothing in
  print, in a screen reader, or to eight percent of men.
- **Tables are for comparable rows.** A table used for layout reads as gibberish aloud.
- **Long documents get headings a reader can scan**, because most readers arrive mid-document via
  search and never see the top.

## What to hand back

A list of specific edits, each naming the line, the problem and the replacement. Plus, separately:
anything that looked like a **content** problem rather than a clarity one — an ambiguous rule, a
term used two ways, a threshold with no unit. Those go to the owner untouched. You are reviewing
how it reads, not deciding what it says.

## Watch yourself

The failure mode of this review is agreeing with the document. Expert prose matches the shape of
everything else you have read, so it reads as fine. Three checks that break the spell:

1. Read one paragraph as someone with no background. Which words stop them?
2. Count the undefined terms in the densest paragraph. Say the number out loud.
3. Find the first "obviously", "simply" or "just". There is almost always one, and it is almost
   always sitting on the missing explanation.
