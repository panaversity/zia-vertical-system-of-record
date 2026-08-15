---
title: The Vertical System of Record
sidebar_position: 3
description: The repeatable unit — one profession's governed knowledge, compiled into a website and an MCP server.
---

# The Vertical System of Record

A **vertical system of record** is one profession's governed knowledge, compiled into the two
surfaces that profession needs: a site its people read, and a server its AI assistants query.

It is the repeatable unit. Tax law, clinical guidelines, aviation maintenance,
building codes — the domains differ entirely, and the machinery does not.

## What the owner supplies

Markdown, and a little configuration. That is the whole authored surface:

```text
knowledge/     the corpus — governed markdown, the single source of truth
instance.md    what this deployment is
site/          how it is presented — config and design tokens
```

Everything else — the retrieval kernel, the ingest pipeline, the site runtime — is installed
machinery, upgraded underneath the project rather than copied into it. The owner's escape hatch is
that the parts that matter, the content and the record of what was built, live in their own
repository.

## The abstention floor

The property that makes a vertical SoR worth more than a search box is calibrated refusal.
Retrieval returns something for every query — that is what retrieval does — so a similarity score
below a measured floor must be treated as *no answer*, not a weak one.

That floor is measured per corpus, against a gold set and a set of deliberately out-of-scope
probes. **It is never inherited from another domain**: a threshold that separates signal from noise
in one corpus is meaningless in another, and copying it is how a system starts confidently
answering questions it should have declined.

Until a floor has been measured, the honest configuration is to leave the gate off and say so —
loudly, in the health report — rather than to guess a number that looks reasonable.

## Where the value compounds

The corpus is written once and serves every surface, including the ones that do not exist yet.
Adding a surface is a compilation target, not a rewrite — which is why the discipline of keeping
knowledge separate from presentation pays for itself the first time a second reader arrives.
