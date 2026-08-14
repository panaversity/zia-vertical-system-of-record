---
name: docx
description: Convert a Word document (.docx) into governed markdown for knowledge/ — faithful text extraction, tracked-change and comment detection, tables and figures, and the provenance the corpus requires. Use whenever a source arrives as .docx, .doc or a Word export, or when checking that an already-converted document matches its Word original.
---

# Word documents as sources

A `.docx` is a ZIP archive of XML. Everything in it is readable without opening Word — which
matters here, because the parts that carry governance risk (tracked changes, comments, the
document's own metadata) are exactly the parts a quick copy-paste loses.

This skill converts **into** the corpus. Producing Word documents is not part of this project; if
the owner asks for one, say that the corpus is the deliverable and offer the markdown.

## 1 · Establish what the file actually is

Before converting, answer two questions. Both have burned real corpora.

**Is this the final document, or a draft with unaccepted edits?**

```bash
unzip -p source.docx word/document.xml | grep -c '<w:ins \|<w:del ' # 0 = clean; >0 = revision marks
```

If the count is non-zero, the file carries tracked changes. Converting it silently picks one
version of the truth. Ask the owner which state is authoritative, and record the answer.

**Who owns it and when was it true?**

```bash
unzip -p source.docx docProps/core.xml   # title, creator, lastModifiedBy, created, modified
```

These are hints, not authority — a "modified" date is whoever last opened it. Use them to ask the
owner the real question: what is this document, and as at when is it correct?

## 2 · Extract the text

```bash
# --track-changes=all keeps insertions and deletions visible so nothing disappears quietly
pandoc --track-changes=all source.docx -o draft.md

# with figures, when the document's meaning depends on them
pandoc --track-changes=all --extract-media=./media source.docx -o draft.md
```

`draft.md` is scratch, not corpus. It goes somewhere temporary — never straight into
`knowledge/`.

If `pandoc` is unavailable, read the XML directly: `unzip -o source.docx -d unpacked`, then
`unpacked/word/document.xml`. Text lives in `<w:t>` elements; `<w:tbl>` is a table;
`<w:footnotes>`, `word/comments.xml` and `word/media/` hold the rest.

## 3 · Check what the conversion dropped

Converters lose things silently. Walk this list against the original before trusting the output:

| Thing | How it fails | Check |
| :--- | :--- | :--- |
| **Comments** | dropped entirely by most converters | `unzip -l source.docx \| grep comments` — read `word/comments.xml`; a comment often holds the caveat the sentence lacks |
| **Merged table cells** | flatten into the wrong row, silently changing which value belongs to which label | eyeball every table (step 4) |
| **Headers / footers** | dropped — this is where "Draft", "Confidential" and version numbers live | `unzip -p source.docx word/header1.xml` |
| **Text boxes, SmartArt, charts** | dropped or emptied | if the document has diagrams, step 4 is mandatory |
| **Footnotes** | usually kept, but renumbered | spot-check the last one |
| **Numbered lists** | restart at 1 or lose depth | check any list a rule depends on |

## 4 · Look at the original

For anything with tables, figures or a layout that carries meaning, render it and look:

```bash
soffice --headless --convert-to pdf source.docx
pdftoppm -jpeg -r 150 source.pdf page      # page-1.jpg, page-2.jpg, …
```

Then read the images. A table that converted into prose, a figure caption attached to the wrong
figure, a column that shifted — these are invisible in the markdown and obvious on the page.

## 5 · Write it into the corpus

Now follow `.agents/skills/add-sources/SKILL.md`: one topic per file, the frontmatter contract,
faithful values, flags rather than smoothing. On top of that, this source type owes:

- **The source, named in the document** — file name, the document's own title, and the "as at"
  date you established in step 1.
- **Every load-bearing number re-read against the original**, not against `draft.md`. Table
  conversion is where corpora acquire wrong numbers.
- **Comments and tracked changes reported to the owner**, never merged into the text as if they
  were settled. A margin comment saying "check this with legal" is information about the corpus's
  reliability, and it must not vanish in conversion.
- **Nothing invented to make the prose flow.** A heading that was a page break in Word, a
  paragraph that reads as a fragment — leave the gap and flag it. Word's layout is not an
  argument you get to reconstruct.
