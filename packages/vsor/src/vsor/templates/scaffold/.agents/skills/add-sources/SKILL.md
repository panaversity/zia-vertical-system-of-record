---
name: add-sources
description: Convert source material — PDFs, folders, URLs, pasted text — into governed markdown under knowledge/. Load before adding anything to the corpus.
---

# Adding sources

The full `add-sources` contract (`specs/vsor/add-sources`) is not ratified yet. Until it is,
this file is the whole rule set — short on purpose.

## The rules

1. **One topic per file** in `knowledge/`. If a source covers three topics, it becomes three
   files, each with a name a reader would guess.
2. **Frontmatter:** `title:` is required; `description:` is optional and improves search.
   Three more are optional and are about *time* — see the next rule. Nothing else yet.
3. **Say when it was true.** If the source carries an effective date, record it; if this
   document replaces one already in `knowledge/`, mark the old one instead of deleting it:

   ```yaml
   effective: 2024-01-01              # the day this document's content took effect
   superseded: true                   # this document is no longer current
   superseded_by: rules/filing.md     # what replaced it, as a path under knowledge/
   ```

   Naming a successor already means the document is no longer current, so
   `superseded: true` on its own is for something withdrawn with no replacement.
   `superseded_by` must name a document this project publishes — `vsor build` refuses a
   pointer that resolves to nothing. **Never delete a replaced document:** every citation
   already pointing at it stops resolving, and a citation that resolves to nothing looks
   exactly like one that was invented.
4. **Convert faithfully.** Keep numbers, dates, thresholds, and qualifiers exactly as the
   source states them — "up to $500,000" never becomes "about $500,000". Do not summarize a
   rule into a softer rule.
5. **Flag, don't smooth.** When a source is ambiguous, contradicts another document, or seems
   wrong, tell the project owner and leave the claim marked — never resolve it silently. What
   lands in `knowledge/` will be cited as truth.
6. **Read it like a reader.** After adding, run `vsor dev` and read the rendered page the way a
   reader would — not by re-reading the markdown you just wrote.

## Which skill for which source

| The source is | Read first |
| :--- | :--- |
| a Word document | `.agents/skills/docx/SKILL.md` |
| a slide deck | `.agents/skills/pptx/SKILL.md` |
| an expert, or a pile of policies | `.agents/skills/knowledge-extraction-method/SKILL.md` |
| someone else's software, API or standard | `.agents/skills/fetch-library-docs/SKILL.md` |
| a PDF, a URL, pasted text | this file is enough |

Whatever the source, the governing rules are `.claude/rules/provenance.md` (every claim traces
home) and `.claude/rules/abstention.md` (a gap stays a gap).
