---
name: content-refiner
description: Tighten a corpus document that is padded, duplicated or buried — cutting words without changing a single thing the document asserts, verified by a claim inventory taken before and after. Use when a document reads long, when the same rule appears in two places, or when a review says the point is hard to find.
---

# Refining a document without changing it

Refinement here is not editing for style. It is removing text that carries no claim, while proving
that every claim survived. The proof is the point: in a governed corpus, a tightened document that
quietly lost a qualifier is worse than the bloated one it replaced.

## Step 0 · Take the claim inventory (do not skip)

Before touching a word, list every claim the document makes. One line each, in document order:

```
1. Records of class A are retained 7 years from termination   [§14, 2024 policy]
2. Class A includes signed contracts and amendments            [§14.1]
3. Drafts are destroyed at signature                           [§14.3]
4. Retention is suspended by a litigation hold                 [§21 — exception to 1]
5. NOT COVERED: retention for records created before 2019      [flagged to owner]
```

Capture every number, unit, qualifier ("up to", "no later than", "unless"), condition, exception,
scope and source. This list is the contract for the rest of the work. At the end, the same list is
regenerated from the refined document and the two must match exactly — same claims, same values,
same qualifiers, same order of dependency.

## Step 1 · Diagnose which problem it has

Three different failures need three different treatments. Applying the wrong one damages the
document.

| Symptom | Problem | Treatment |
| :--- | :--- | :--- |
| Long, but every paragraph says something new | **not a refinement job** — say so and stop | — |
| Words with no claim under them: throat-clearing, restatement, "why this matters" | **padding** | step 2 |
| The same claim stated twice here, or once here and once in another document | **duplication** | step 3 |
| The rule is present but the reader cannot find it | **burial** | step 4 |

## Step 2 · Padding

Cut, in this order — each cut removes words while the inventory stays whole:

1. **Introductions that announce the document.** "This document explains…" — the title did that.
2. **Restatement.** A claim made in prose and then again in a table or summary box. Keep whichever
   form a reader in a hurry uses; delete the other. Never keep both "for emphasis": two copies
   drift, and the corpus then contradicts itself.
3. **Motivation that motivates nothing.** One sentence on what a rule protects against is useful;
   three paragraphs on why the area matters are not.
4. **Hedged transitions.** "As noted above, and as we will see below…"
5. **Lists padded to look complete.** Five items where three are real and two are the same item
   twice.

Do not cut: examples that make an abstract rule concrete (one per rule), exceptions, sources, and
anything a reader would have to leave the page to find.

## Step 3 · Duplication

Duplication is the expensive one, because a copy is a second thing that can drift out of date.

- **Inside one document**: keep the statement in the place a reader looks first; the second
  occurrence becomes nothing, or a cross-reference if the distance is real.
- **Across documents**: do not delete either copy on your own. One fact belongs in one document;
  which one is a decision about the corpus's shape, and it is the owner's. Bring them the two
  locations, whether the copies still agree, and your recommendation for the canonical home.
- **Copies that have already diverged** are not a refinement problem at all. Stop, and report it —
  a corpus asserting two different values for one rule is a defect the owner needs to see intact.

## Step 4 · Burial

The claims are right; the reader cannot get to them.

- Put the rule before the exposition. A reader who stops after two lines should have the rule.
- One topic per document. If the second half is a different topic, propose the split rather than
  compressing it into invisibility.
- Headings a reader would search for, in their words, not the source document's internal numbering.
- Move the conditions next to the rule they condition. A qualifier three paragraphs away from its
  rule is a qualifier nobody applies.

## Step 5 · Verify, then report

Regenerate the claim inventory from the refined text. Compare line by line against step 0.

Then report:

```
Refined: knowledge/<path>.md
Problem: padding | duplication | burial (+ which)
Words: <before> → <after>
Claims: <n> before, <n> after — identical (or: LIST every difference)
Cut: <what was removed, by kind — not a diff, a summary a reviewer can check>
Raised for the owner: <duplications across documents, divergences, anything ambiguous>
```

If a single claim, number, qualifier or source differs between the two inventories and you did not
intend it, revert the change. The refined document is only correct if the inventory is identical —
and if you *did* intend it, then it is not a refinement, it is a content edit, and it goes to the
owner as one.
