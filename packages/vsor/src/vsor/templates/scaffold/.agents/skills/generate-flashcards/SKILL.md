---
name: generate-flashcards
description: Build a `<Flashcards />` deck for a corpus document — recall cards that lock in the facts and thinking cards that force real understanding, in the exact deck shape this project's Flashcards component takes, with every figure verbatim from the source. Use when a document holds definitions, thresholds or a framework a reader has to carry in their head.
---

# Flashcards

Two kinds of card, roughly half and half: **recall** cards that pin the facts a reader must have
exactly right, and **thinking** cards that force them to reason rather than recognise. Everything
below is either the component's contract or the difference between a deck that works and one that
feels like busywork.

Plan the deck before writing a single card. The order is: read the document → list the concepts →
decide each card's type → write.

## The component contract

`<Flashcards />` renders in any document under `knowledge/` with no import. The deck goes in as the
`cards` prop:

```jsx
<Flashcards
  cards={{
    deck: {
      id: "retention-periods",
      title: "Retention periods",
      description: "Class definitions, clocks and holds from the retention policy",
      tags: ["retention", "records"],
      version: 1,
    },
    cards: [
      {
        id: "retention-periods-001",
        front: "Under the retention policy, when does the clock start for a Class A record?",
        back: "At termination, not signature.",
        tags: ["retention"],
        difficulty: "basic",
      },
      {
        id: "retention-periods-002",
        front: "Why does a litigation hold override the retention schedule rather than extend it?",
        back: "The schedule authorises destruction; a hold removes that authorisation entirely, so records are kept until the hold lifts — the clock does not restart.",
        tags: ["retention", "holds"],
        difficulty: "intermediate",
        why: "What happens to a record whose hold lifts after its retention period expired?",
      },
    ],
  }}
/>
```

| Field | Rule |
| :--- | :--- |
| `deck.id` | kebab-case, unique across the corpus — it prefixes every card id |
| `deck.title` | what the deck is |
| `deck.description` | one sentence |
| `deck.tags` | array of strings |
| `deck.version` | integer; bump it when you revise an existing deck |
| `cards[].id` | exactly `<deck.id>-NNN`, three digits, sequential. Never shorten the prefix |
| `cards[].front` | the question — always ends in `?` |
| `cards[].back` | the answer |
| `cards[].tags` | optional |
| `cards[].difficulty` | optional: `basic`, `intermediate` or `advanced` |
| `cards[].why` | optional; **thinking cards only** — one deeper question, under 20 words |

`<Flashcards />` with no `cards` prop renders "Flashcards are not available for this page yet."
The component also accepts `tags`, `maxDifficulty` and `hideExport` props, which currently have no
effect — do not author against them.

## What makes a good card

### Recall cards — half the deck

One question, one answer, answerable in about five seconds.

- **Front under 40 words**, and self-contained. A reader meeting this card three weeks later has
  forgotten which document it came from: "What is the third category?" is unanswerable; "Under the
  retention policy, what is the third record class?" is not.
- **Back under 15 words. Just the fact** — no "because", no elaboration. If the back needs
  explaining, it is a thinking card. If it tests two things, it is two cards.
  *Exception*: an enumeration may run longer if each item is five words or fewer, one per line.
- **No filler fronts.** Not "According to the document, what…" — just ask.
- **No `why` field** on a recall card.

### Thinking cards — the other half

Ten to thirty seconds of actual reasoning.

- **Front under 25 words**, phrased as a *Why* or *How* question, or a one-sentence scenario. If
  the front runs to a paragraph, the reader is reading, not retrieving.
- **Back 20–40 words carrying a reasoning chain** — X *because* Y, *therefore* Z. Read the back
  alone: if it is a fact someone could memorise off a bullet, this is a recall card wearing a
  costume. Reclassify it.
- **Back is a claim with a reason, not persuasion.** Strip adjectives; keep the causal link.
- **`why` is required**, and must push somewhere new — implications, prevention, the adjacent case.
  Never a rephrasing of the front.
- **Vary the shape.** Scenarios, counterfactuals, comparisons, causes. At most two cards per deck
  may use "Why does the document say…".

## Card content is corpus content

Every card is a claim on the site, so:

- **Every figure, date, threshold and proper noun appears verbatim in the source document.** Do not
  round, convert, infer, or compute. If you cannot point at the sentence, cut the card.
- **Nothing from outside the corpus.** A true fact with no source in `knowledge/` is exactly the
  thing this project exists to keep out.
- **A card that oversimplifies a rule is wrong**, even if it reads well. Qualifiers ("unless",
  "up to", "no later than") are part of the answer, not padding to trim for the word limit. If the
  qualifier will not fit, the card is testing too much — split it.

## Process

1. **Read the whole document.** Separate what must be *memorised* (terms, thresholds, the members
   of a set) from what must be *understood* (why a rule has an exception, what breaks without it).
2. **List the concepts first**, numbered, each tagged `R` (recall) or `T` (thinking). Every card
   you write must trace to a line on this list; a card that does not is either a missing concept or
   filler.
   - Every `##`/`###` section should produce at least one concept.
   - A document built around an enumeration ("the five classes") owes a card per item — a reader who
     "sort of remembers three of five" has not learned it.
   - If the R/T split is worse than 60/40, rebalance before writing. Concepts involving a tradeoff
     or a cause are usually `T` in disguise.
3. **Write, declaring the type before each card.** Never let a card's type emerge from what you
   happened to write — that is how hybrids appear.
4. **Size the deck by concepts, not words.** Roughly one card per 150–200 words of prose is a
   starting estimate; a dense definitions page earns more, a thin one fewer. Floor 8, ceiling 30.
   Never pad.
5. **Never card a long list as one card.** Six or more items becomes "name any three of the six",
   plus individual cards for the items that matter.

## Quality gate

Run this before handing back. Any failure means revise and re-check.

- [ ] Card ids match `<deck.id>-NNN` exactly, sequential, no duplicates
- [ ] Every front ends with `?`; no front starts with filler
- [ ] Recall backs under 15 words and free of "because"; thinking backs 20–40 words with a
      reasoning chain
- [ ] Every thinking card has `why`; no recall card does
- [ ] No back starts with "Yes" or "No"
- [ ] Recall/thinking balance between 45/55 and 55/45
- [ ] No compound fronts (an "and" joining two questions)
- [ ] Difficulty spread — roughly a third basic, half intermediate, the rest advanced
- [ ] Every figure and proper noun verified verbatim against the document
- [ ] No two cards share a back
- [ ] `vsor build` succeeds, and you flipped through the deck in `vsor dev`

## Report

```
Deck: <deck.id> in knowledge/<path>.md
Cards: <n> (recall <n>, thinking <n>)
Concepts: <n> listed, <n> carded, <n> skipped (say which, and why)
Gate: id format / fronts / back lengths / why fields / balance / difficulty — pass or the failures
Verbatim check: <n> figures verified, <n> removed as unverifiable
```

## Revising an existing deck

Bump `deck.version`. Keep the ids of cards whose concept is unchanged, even if the wording moved —
a stable id is what lets a reviewer see that card 007 was reworded rather than replaced, and what
keeps an exported deck lining up with the one on the page. Append new cards after the highest
existing number; never renumber. Then run the whole gate on the revised deck, not just the new
cards.
