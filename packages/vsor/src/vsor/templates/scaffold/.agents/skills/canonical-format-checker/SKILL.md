---
name: canonical-format-checker
description: Check a corpus document against this project's actual canonical format — frontmatter, headings, filenames, links and the MDX syntax rules that decide whether a page builds at all — by reading the canonical source rather than recalling it. Use before adding documents, after a bulk conversion, and whenever two documents in knowledge/ disagree about how something is written.
---

# Canonical format

Format in a corpus is not cosmetics. It decides the URL a citation points at, the title a search
result shows, and whether the site builds. Drift is quiet: one document invents a variation,
the next copies it, and six months later the corpus has two conventions and no way to say which
one is right.

**The rule of this skill: never check format from memory. Read the canonical source, then check.**

## Where the canonical answer lives

| Question | Canonical source |
| :--- | :--- |
| Document frontmatter | `.agents/skills/add-sources/SKILL.md`, then the existing documents in `knowledge/` |
| What builds and how the site is configured | `site/docusaurus.config.ts` |
| Quiz markup and its props | `.agents/skills/quiz-generator/SKILL.md` |
| Flashcard deck shape | `.agents/skills/generate-flashcards/SKILL.md` |
| Skill files | any `SKILL.md` in `.agents/skills/` |
| How work is done here at all | `.claude/rules/` and `AGENTS.md` |

**When the existing documents disagree with each other, the corpus has already drifted.** That is a
finding for the owner, not a tie for you to break: report both spellings, how many documents use
each, and which one the earliest and most-referenced documents use.

## The checks

### Frontmatter

```yaml
---
title: The document's real title
description: One sentence. Optional, and it improves search.
---
```

- `title` is required. Without it the page falls back to the first heading or the filename, and
  citations end up pointing at something like "01-draft-final".
- Nothing else unless a canonical source says so. Invented keys are ignored silently by the build,
  which makes them worse than an error — they look like they work.
- The frontmatter block is the first thing in the file. A blank line before `---` breaks it.

### Headings and title

- Exactly one `#` H1 per document, and it says the same thing as `title`.
- Headings are what a reader would search for, not the source document's internal numbering.
  "Retention periods" beats "§14".
- No heading levels skipped (`##` then `####`) — the skip breaks the on-page outline.

### Filenames

- The path *is* the identity: it becomes the URL and the citation. Lowercase, hyphens, no spaces,
  no dates unless the date is genuinely part of the topic.
- A rename changes every existing link and citation to that document. Deliberate only, and tell
  the owner.

### MDX syntax — the build-breakers

Documents under `knowledge/` are parsed as MDX, so a handful of ordinary characters are code:

| Pattern | What happens | Fix |
| :--- | :--- | :--- |
| `<` followed by a letter (`<30 days`, `<name@example.com>`) | parsed as a JSX tag; build fails or the text vanishes | `&lt;30 days`, or wrap in backticks |
| `{` in prose (`{amount}`, `{}`) | parsed as a JSX expression | backticks, or `&#123;` |
| An unclosed component (`<Quiz>` without `/>`) | build fails with a parse error pointing at the wrong line | close it; self-close when it has no children |
| A stray `>` at line start | becomes a blockquote | intended, or escape it |

Prose that contains code, ranges, or template placeholders is where this bites. Backticks are the
cheap universal answer.

### Links

- Links between documents are relative and include the extension: `[retention](./retention.md)`.
  The build resolves them to the final URLs, and reports the ones whose target does not exist —
  read that output; a broken cross-reference in a corpus is a broken citation.
- External links carry the full URL. A bare domain in text is not a link.

### Components

Only the components this project actually ships, spelled exactly as their skills document them.
An unknown tag is not an error you can ignore: MDX will try to render it as an HTML element and the
page will silently lose the content.

## The check that settles it

Static reading finds most drift. The build finds the rest:

```bash
vsor build      # parses every document; a format error fails here, loudly, with the file and line
```

Run it before handing work back. A document that reads fine and does not build is not done, and a
document that builds is not automatically right — the frontmatter and heading checks above are the
half a build cannot see.

## Reporting

Name the file, the line, the canonical source you checked against, and the exact replacement:

```
knowledge/retention.md:12
  found:     ## §14 Retention
  canonical: headings are what a reader searches for (add-sources: "a name a reader would guess")
  fix:       ## Retention periods

knowledge/retention.md:31
  found:     kept for <7 years
  canonical: MDX parses `<` + letter as a tag
  fix:       kept for `<7 years`
```

Vague feedback ("fix the formatting") is not a finding. If you cannot name the canonical source for
a rule you are enforcing, you are enforcing a preference — drop it, or ask the owner to make it
canonical first.
