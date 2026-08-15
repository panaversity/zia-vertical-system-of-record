# Provenance

Every claim in `knowledge/` traces back to a source document. That is the whole product: a reader
and an AI assistant both get an answer they can follow home.

## The rules

1. **Name the source in the document.** Not in a commit message, not in a chat reply — in the
   markdown, where a reader who lands on the page cold can see it. A document nobody can trace is
   a rumour with good typography.
2. **Copy load-bearing values exactly.** Numbers, dates, thresholds, deadlines, jurisdictions,
   and the qualifiers around them: "up to $500,000" never becomes "about $500,000"; "within 30
   days of filing" never becomes "within a month". If a value is worth writing down, it is worth
   writing down unchanged.
3. **If you cannot trace it, it does not go in.** A plausible sentence with no source is the most
   expensive thing you can add here — it reads exactly like a checked one, and both surfaces will
   serve it as if it were.
4. **Two sources that disagree stay two sources.** Record both, say which document each came from,
   and tell the owner. Never resolve a conflict silently by picking the one that reads better.
5. **Say when it was true.** Rules change, and a correct answer from 2019 is a wrong answer now.
   Three optional frontmatter keys carry that fact, and both surfaces read them:

   ```yaml
   effective: 2024-01-01              # the day this document's content took effect
   superseded: true                   # this document is no longer current
   superseded_by: rules/filing.md     # what replaced it, as a path under knowledge/
   ```

   A page with `effective:` shows the date; a superseded page opens with a notice above its
   content. If a source carries a version or an "as at" line as well, that belongs in the body
   — the keys record the fact, the document explains it.
6. **A replaced document is marked, never deleted.** Mark the old one and add the new one. Every
   citation already pointing at the old page — in an email, in a filing, in another agent's
   answer — stops resolving the moment the file is gone, and a citation that resolves to nothing
   is indistinguishable from one that was invented. `vsor build` refuses a `superseded_by` that
   names a document the project does not publish, so the two halves cannot fall out of step.

## What provenance is not

Provenance proves **who said something and when**. It does not prove the claim is right, current,
or uncontested. When you notice a source that looks superseded, is a minority position, or is
plainly wrong — say so to the owner. That judgment is the expert's, not yours, and it is not
something a citation can supply.
