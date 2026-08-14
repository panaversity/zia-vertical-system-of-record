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
   Nothing else yet.
3. **Convert faithfully.** Keep numbers, dates, thresholds, and qualifiers exactly as the
   source states them — "up to $500,000" never becomes "about $500,000". Do not summarize a
   rule into a softer rule.
4. **Flag, don't smooth.** When a source is ambiguous, contradicts another document, or seems
   wrong, tell the project owner and leave the claim marked — never resolve it silently. What
   lands in `knowledge/` will be cited as truth.
5. **Read it like a reader.** After adding, run `vsor dev` and read the rendered page the way a
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
