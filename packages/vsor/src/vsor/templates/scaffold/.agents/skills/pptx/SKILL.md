---
name: pptx
description: Turn a slide deck (.pptx) into governed markdown for knowledge/ — text and speaker-note extraction, slide-order reasoning, and the judgment about which bullet fragments are actually claims. Use whenever a source arrives as a deck, a training presentation, or an exported slide PDF.
---

# Slide decks as sources

Decks are the lowest-fidelity source a corpus receives, and the most common. A slide is a prompt
for a person who was in the room: the bullets are fragments, the argument lives in the order, and
the actual content is often only in the speaker notes — or only in the presenter's head.

Extracting a deck is therefore two jobs. The mechanical one is easy. The governance one — deciding
which fragments are claims — is the whole skill.

## 1 · Extract text and notes

A `.pptx` is a ZIP of XML. There is no reliable one-command conversion; this reads both halves:

```python
import html, re, zipfile

deck = zipfile.ZipFile("source.pptx")
names = deck.namelist()
runs = lambda xml: [html.unescape(t) for t in re.findall(r"<a:t>(.*?)</a:t>", xml, re.S)]

slides = sorted(
    (int(re.search(r"\d+", n.rsplit("/", 1)[1]).group()), n)
    for n in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)
)
for num, name in slides:
    print(f"\n--- slide file {num} ---")
    print("\n".join(runs(deck.read(name).decode("utf-8"))))
    note = f"ppt/notesSlides/notesSlide{num}.xml"
    if note in names:
        print("[notes] " + " ".join(runs(deck.read(note).decode("utf-8"))))
```

Three traps in that output — all of them silent:

- **The file number is not the slide's position.** `slideN.xml` is creation order; deleting slide 3
  leaves a gap, and reordering changes nothing on disk. The deck's real order is the `<p:sldIdLst>`
  in `ppt/presentation.xml`. Read it whenever sequence carries meaning — which, in a deck, is most
  of the time.
- **Notes are matched to slides by relationship, not by number.** `notesSlide3.xml` is not
  guaranteed to belong to `slide3.xml`. When notes carry real content, confirm each pairing in
  `ppt/slides/_rels/slideN.xml.rels`.
- **Reading order is not visual order.** `<a:t>` runs come out in XML order, which is shape
  creation order. A two-column slide can extract interleaved. Step 2 is how you catch it.

Images and diagrams live in `ppt/media/`. Charts are data, not text: their numbers are in
`ppt/charts/` and will not appear in the extraction above.

## 2 · Look at the deck

```bash
soffice --headless --convert-to pdf source.pptx
pdftoppm -jpeg -r 150 source.pdf slide      # slide-1.jpg, slide-2.jpg, …
```

Read the images. Decks lean on diagrams, arrows, colour and adjacency to carry meaning that no
text extraction can recover. If a slide's point is a picture, the corpus needs prose that states
the point — written from the picture, and flagged for the owner to confirm.

## 3 · Decide what is actually a claim

This is the step that separates a governed corpus from a pile of bullets. For each fragment:

| Fragment | Verdict |
| :--- | :--- |
| "Tighter limits from Q3" | **Not a claim.** Which limits, what value, effective when, applying to whom? Ask, or leave it out. |
| "Approval needed above $50k" | **A claim, incomplete.** Whose approval, in what currency, per transaction or per year? Record what the deck says, flag what it does not. |
| "Retention: 7 years (per §14 of the 2024 policy)" | **A claim with a source.** Convert it — and go get §14, which is the better source. |
| "Why this matters" / "Key takeaways" | **Rhetoric.** Drop it. |

The rule: **never promote a fragment to an assertion by completing it.** If the deck says
"tighter limits" and you write "limits were reduced to $50,000", you have invented the corpus's
first wrong number. Write what is there, flag the gap, and tell the owner which document would
settle it.

## 4 · Treat the deck as weak provenance

A deck usually has no effective date, no author accountable for the wording, and no review trail.
Say so in the document you write:

- Name the deck, its title slide, and any date visible on it — plus who presented it, if known.
- **Prefer the source the deck cites.** A slide quoting a policy is a pointer to the policy. Convert
  the policy; cite the slide only as how it reached you.
- If the deck is the *only* source for a rule, that fact belongs in the document. A reader
  deciding whether to rely on it deserves to know it came from slide 12 of a training pack.

## 5 · Write it into the corpus

Follow `.agents/skills/add-sources/SKILL.md` — one topic per file, the frontmatter contract, no
smoothing. A 40-slide deck almost never becomes one document and almost never becomes 40: it
becomes however many topics it actually covers, each of which a reader would go looking for by
name. Slide numbers are not topics.
