---
name: quiz-generator
description: Write a `<Quiz />` for a corpus document — four-option questions with the exact props this project's Quiz component takes, every answer traceable to a source document, and the option-length and answer-distribution checks that stop a reader from guessing without reading. Use when a document needs a self-check, or when reviewing an existing quiz.
---

# Quizzes

A quiz in a system of record is not an assessment. It is a way for a reader to find out whether
they actually understood what the corpus says — and it is **corpus content**, held to the same
standard as everything else. A quiz answer that is wrong is a wrong claim on the site, with a
confident green tick next to it.

## The component contract

This is fixed. `<Quiz />` renders in any document under `knowledge/` with no import.

```jsx
<Quiz
  title="Retention rules — check yourself"
  questions={[
    {
      question: "A signed contract terminates on 1 March. When may it be destroyed?",
      options: [
        "Immediately after termination",
        "Seven years after termination",
        "Seven years after signature",
        "Only with the owner's approval",
      ],
      correctOption: 1,
      explanation:
        "Class A records run seven years from termination, not from signature — so the clock starts on 1 March. Destroying at termination misses the retention period entirely; running from signature ends it early; approval is not a retention rule.",
      source: "Retention periods — Class A",
    },
  ]}
  questionsPerBatch={10}
/>
```

| Prop | Rule |
| :--- | :--- |
| `questions` | required; an array of question objects |
| `question` | the stem, as a string |
| `options` | **exactly four**, always — not three, not five |
| `correctOption` | the **index**: `0`, `1`, `2` or `3`. Never `4`, never a letter |
| `explanation` | optional, and you always write one |
| `source` | optional, and you always write one — the document or section in *this corpus* the answer comes from |
| `title` | optional heading for the block |
| `questionsPerBatch` | optional; the component shuffles the questions and shows this many per attempt (default 15). Fewer questions than the batch size means all of them show |

## What a question may be about

**Only what the corpus says.** Every stem, every option and every explanation must be answerable
from documents in `knowledge/`. No outside knowledge, no plausible-sounding scenario that asserts a
fact no document contains, no "industry practice" distractors that are actually true but unsourced.

- Set `source` to the document and section a reader should re-read. If you cannot name one, the
  question does not belong here — it is a gap in the corpus, and that is a finding for the owner.
- Test the thing that matters: the condition, the threshold, the exception, the boundary between
  two rules. Not the vocabulary.
- A question whose answer is a number must use the number exactly as the document states it,
  including its unit and qualifier.

## Distractors

Three wrong options that are all obviously wrong teach nothing and measure nothing. Each distractor
should be something a reader who half-read the document would actually pick:

- the right rule with the wrong trigger ("from signature" instead of "from termination")
- the neighbouring rule from an adjacent document
- the rule as it was before an exception applied
- the plausible-but-unsourced answer — the exact thing the corpus exists to prevent

Never make a distractor from something the corpus asserts elsewhere as true, unless the question
makes the scope explicit. A "wrong" answer that is right in another context is a corpus bug.

## Explanations

Address **all four** options. Every explanation says why the correct one is correct, and then why
each of the other three fails — briefly, one clause each. This is where a reader who guessed
learns something, and it is also where you find out your own question was ambiguous.

## The two mechanical checks

### Answer distribution

Spread `correctOption` across 0–3 roughly evenly. No index over about a third of the questions, and
no run of three identical indices — readers and pattern-matchers both find these fast.

### Option length

Length is a tell. A reader who cannot answer picks the longest option, and they are usually right,
because the correct answer accretes qualifiers.

**The rule, on both metrics:** the correct option must not be the *unique* longest in its question
by word count **or** by character count. A tie at the maximum is fine — the reader cannot single it
out. Vary which distractor is longest.

*Why characters and not just words: measured on generated question sets (2026-06-02), writer agents
reliably satisfied a ±3-word bar and still left the correct answer the sole longest by characters in
roughly a third of questions. Readers eyeball visual length, which tracks characters. Word parity is
necessary and not sufficient.*

Check it mechanically, never by eye:

```python
import collections, re
block = re.search(r'<Quiz\b.*?/>', open(DOC).read(), re.DOTALL).group(0)
qs = [(re.findall(r'"((?:[^"\\]|\\.)*)"', o), int(c))
      for o, c in re.findall(r'options:\s*\[([^\]]*)\]\s*,\s*correctOption:\s*(\d+)', block, re.DOTALL)]
for n, (opts, ci) in enumerate(qs, 1):
    if len(opts) != 4: print(f"Q{n}: {len(opts)} options — must be exactly 4")
    wc = [len(o.split()) for o in opts]; cc = [len(o) for o in opts]
    if wc[ci] == max(wc) and wc.count(max(wc)) == 1: print(f"Q{n}: correct is sole WORD-longest")
    if cc[ci] == max(cc) and cc.count(max(cc)) == 1: print(f"Q{n}: correct is sole CHAR-longest")
print("distribution:", dict(collections.Counter(c for _, c in qs)))
```

Fix a violation by trimming the correct option or lengthening a plausible distractor — never with
filler, and never by moving the answer, which would break the distribution you just balanced.

## Before you hand it back

- [ ] Every question answerable from a named document; `source` set on all of them
- [ ] Exactly four options each; `correctOption` in 0–3 and pointing at the right one
- [ ] Explanations address all four options
- [ ] Distribution spread; no run of three
- [ ] Neither length check fires
- [ ] `vsor build` succeeds — JSX inside a document is code, and a stray brace or quote fails the build
- [ ] You read the rendered quiz and clicked through it in `vsor dev`
