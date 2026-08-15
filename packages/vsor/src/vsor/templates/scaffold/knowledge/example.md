---
title: Start here
description: What this knowledge base is and how documents become answers.
---

# Start here

Every markdown file in `knowledge/` becomes two things: a page on this project's
website, and a governed source an AI assistant can cite. One topic per file. The
`title:` in the frontmatter above is required; `description:` is optional but
improves search.

## Saying when a document was true

A citation proves who wrote something down and when. It does not prove the claim
is still true — and a correctly cited rule that changed two years ago is the most
expensive answer this project can give. Three optional frontmatter keys let a
document say so itself:

```yaml
effective: 2024-01-01              # the day this document's content took effect
superseded: true                  # this document is no longer current
superseded_by: rules/filing.md    # what replaced it, as a path under knowledge/
```

Use them when they are true and leave them out when they are not — a document that
has never been revised carries none of them. A page with `effective:` shows the
date; a superseded page opens with a notice saying so, above everything else on it,
linking to the document named by `superseded_by`. Naming a successor already means
the document is no longer current, so `superseded: true` on its own is for the case
where something was withdrawn and nothing replaced it.

`superseded_by` must name a document this project actually publishes: `vsor build`
refuses a pointer that resolves to nothing rather than letting a reader find it.

**Do not delete a document that has been replaced.** Mark it. Every citation that
already points at it — in an email, a filing, another agent's answer — stops
resolving the moment the file is gone, and a citation that resolves to nothing is
indistinguishable from one that was made up.

Replace this file with your first real document — then run `vsor dev` and read
the rendered page the way a reader would.
