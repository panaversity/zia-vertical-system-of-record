---
title: When a Record Changes
sidebar_position: 5
effective: 2026-02-01
description: Rules move. A governed record says when it started applying, and says so on the page rather than in a commit message.
---

# When a Record Changes

A citation proves who said something and when it was written down. It does not prove the
claim is still true. Those are different properties, and only one of them is what a
professional is actually asking about.

## The failure a citation cannot catch

The dangerous answer in a regulated field is not the uncited one. It is the **correctly
cited rule that stopped being true two years ago**, served with a perfect reference and
full confidence. Nothing about the citation is wrong: that document really does say that,
and it really was checked by somebody accountable. The document has simply been overtaken.

Declining to answer does not help either — the corpus *does* cover the question. It covers
it with an answer that expired.

## What this document says about itself

The frontmatter above carries one line:

```yaml
effective: 2026-02-01
```

That is the day the content on this page started applying. It is a fact the author already
knows at the moment of writing, so recording it costs nothing, and it is the fact a reader
needs to decide whether this page answers a question about last year.

Two more keys exist, and both are optional:

```yaml
superseded: true                          # this document is no longer current
superseded_by: when-a-record-changed.md   # what replaced it
```

`superseded_by` names another document in the corpus, written as its path under
`knowledge/`. Naming a successor already means the document is no longer current, so the
boolean is only written when something was withdrawn with nothing to replace it.

## Why the pointer is checked at build time

A pointer that names a document the corpus does not contain would ship as a banner
promising a replacement and a link that goes nowhere — a governance claim nobody can
check. So it is refused when the site is built, next to the file and the value, rather
than discovered by a reader who followed it.

Three keys, and no status vocabulary beyond them. A record that has never been revised
carries none of them and is a finished record.
