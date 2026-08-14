---
name: knowledge-extraction-method
description: The structured method for getting professional knowledge out of expert heads and institutional documents and into knowledge/ — domain diagnosis, the five-question expert interview, three-pass document extraction, contradiction mapping, and the probe set that proves the corpus answers and declines correctly. Use when starting a corpus, when a corpus produces generic answers, when a large document set needs converting, or when deciding what is still missing.
---

# The knowledge extraction method

The knowledge that makes a system of record worth consulting is rarely the knowledge that is easy
to write down. Experts hold pattern recognition, calibrated judgment and exception instincts that
resist documentation because they live in experience. Institutions hold the rest across handbooks,
policies and procedures that contradict each other quietly.

This is the method for getting both out. The output is governed markdown in `knowledge/` — plus
two working documents for the owner that never become corpus: a **contradiction map** and a **gap
list**.

## Step 1 · Diagnose where the knowledge lives

This decides which method is primary. Getting it wrong wastes the expert's time or produces a
corpus of platitudes.

| Domain shape | Primary method | Sequence |
| :--- | :--- | :--- |
| **Expert-head** — the documented material is scaffolding; the calibration is the substance | A | interview first, then verify against documents |
| **Document** — the knowledge genuinely lives in handbooks, policies, procedures | B | three-pass extraction first, then a focused interview on contradictions and gaps |
| **Both** — substantial judgment *and* substantial documented standards | A + B | run both fully, reconcile per step 4 |

Three questions that classify it in ten minutes:

1. If the most experienced person left tomorrow, what would be hardest to replace — and is it in
   their head or in the documents?
2. If every documented policy vanished, what would have to be reconstructed from memory?
3. Are there situations where professional judgment and the documented standard give different
   answers?

## Step 2 · Method A — the expert interview

### Brief first

Before the interview, tell the expert three things: you are building a record that answers
questions in their name; they will read and correct everything before it counts; and this session
is a starting point, not a final examination. This moves them from performance mode (presenting
credentials) into collaboration mode (building something they will use). The shift determines the
quality of everything that follows.

### The five questions

Ask in order; follow their experience rather than the script when it goes somewhere real.

**Q1 — "Walk me through a recent example of this work going well."**
Activates memory of specific events instead of general description. Surfaces the decision sequence
and the signals they read. Follow-ups: *What did you look at first? What told you it was going
right?*

**Q2 — "Tell me about a time it went wrong because of a judgment call, not bad luck."**
The most valuable question in the set. Post-mortems are sanitised and mistakes are rarely written
down, so this knowledge exists nowhere else. Follow-ups: *Where could it have been caught? What
signal do you look for now?*

**Q3 — "What does someone junior get wrong that someone senior never does?"**
The fastest path to the expertise differential — and defences are low, because they are describing
someone else's errors. Follow-ups: *A specific example? How long does that take to learn, and why?*

**Q4 — "Write the one-page guide for this work."**
Compresses operational knowledge into the load-bearing rules. Experts resist ("it's more
complicated than that") — the resistance is the point; you are looking for what survives
compression. Follow-ups: *What goes first? Is there a rule you cannot explain?*

**Q5 — "What should never be answered from a document alone?"**
Defines where the corpus must stop and a human must take over. Answers cluster into three:
stakes too high, situation too unusual, the relationship *is* the service. Follow-up: *What is the
threshold, regardless of how good the record gets?*

### Note-taking discipline

The distinction that matters is **specific versus generic**:

| What you hear | Type | What to do |
| :--- | :--- | :--- |
| "We always prioritise risk." | generic | *"Give me a recent case where that changed what you did."* |
| "When receivables days rise while revenue is flat, I treat the revenue as weakening." | specific | capture verbatim — this is a corpus claim |
| "It depends." | generic, promising | *"Walk me through two cases where it went differently."* |

A generic answer is not a failure. It is a signal that the specific knowledge is one follow-up
away.

### Write the summary within the hour

Two paragraphs, immediately — quality degrades fast. Paragraph one: the decision logic that came
out, in its own terms. Paragraph two: where human judgment is irreplaceable. This summary is the
check on everything you write later: if the documents do not carry both paragraphs' substance,
something was lost in transcription.

## Step 3 · Method B — three-pass document extraction

**Pass one — explicit rules.** Read the whole document set and transcribe every stated rule as
*"[X] applies when [condition Y]"*. Do not interpret, infer, or add context. This pass is
transcription with reformatting; completeness beats elegance and the output will be large.

**Pass two — contradiction map.** Read pass one as a set and find the conflicting pairs. Classify
each:

| Type | How it arises | Path |
| :--- | :--- | :--- |
| **Temporal** | a newer policy supersedes an older one, both still circulating | establish which is authoritative, and from when |
| **Jurisdictional** | a global rule and a local one disagree | the expert says which governs where |
| **Interpretive** | two rules overlap with different implied standards | flag the ambiguity; it may need an actual decision |

The contradiction map is a working document for the owner. It never becomes corpus — but every
resolution it produces does.

**Pass three — gaps.** Re-read pass one asking: *what ordinary situation is not covered here?*
Best done with the expert. For each gap the corpus must say which way it falls: low-stakes gaps can
be handled by stating the nearest principle and saying so; high-stakes gaps get an explicit "this
is not covered — escalate" so the surfaces abstain instead of improvising.

## Step 4 · Reconcile the two

When judgment and the documented standard disagree, they do not fight it out in prose:

- **The documented standard sets the boundary** — regulation, liability, published policy.
- **Expert judgment operates inside it** — the calibration that makes the standard usable.

Both go into the corpus, attributed to their sources. Neither swallows the other, and a document
that quietly merges them has destroyed the reader's ability to tell which is which.

## Step 5 · Write it into `knowledge/`

Follow `.agents/skills/add-sources/SKILL.md` for the mechanics. What extraction adds:

- **One claim, its condition, its scope, its source.** "Approval is required above $50,000" is half
  a claim until it says whose approval, in what period, under which policy.
- **Exceptions live with the rule**, not in a separate document nobody reads next to it.
- **Confidence is stated, not implied.** Say which kind of claim each one is: written in a source ·
  consistent practice, not written down · the expert's judgment · unsettled. A reader who cannot
  tell these apart will treat all four as the first one.
- **Escalation is content.** Q5's answers and pass three's high-stakes gaps become documents that
  say "this is not decided here" — the corpus's honest edge, and what makes abstention possible.

## Step 6 · Prove it

A corpus that has never been questioned is a hypothesis. Write two probe sets with the expert:

- **Must answer** — real questions the corpus is supposed to cover, in the words people actually
  use, not in the corpus's own vocabulary. Run them. A question that retrieves nothing means the
  topic exists in someone's head and not in a document.
- **Must decline** — questions just outside the boundary. Not far-away questions, which anything
  declines: the neighbouring rule, the next jurisdiction, last year's version. These are the ones a
  corpus answers wrongly and confidently.

Score them by reading the answers, and note where the failures cluster: missing documents, or
documents that exist but are unfindable in a reader's words, or claims stated so flatly that the
uncertainty behind them vanished. Fix the two weakest documents, re-run, repeat.

Do not import a pass rate from another project. Thresholds are calibrated per corpus, against its
own stakes; a number borrowed from elsewhere is a number nobody here measured.
