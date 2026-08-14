---
name: fetch-library-docs
description: Fetch the current official documentation for an external system — a library, framework, API, standard, product or regulation — before writing any claim about it into knowledge/. Use when a document names a version, an option, an endpoint, a config key, a command or a limit that belongs to someone else's system, and whenever a reader would follow the claim to that system's docs.
---

# External documentation is a source like any other

A corpus is allowed to describe systems it does not own. It is not allowed to describe them from
memory. Anything with a version number changes underneath you, and a confidently wrong option name
is indistinguishable from a checked one once it is in `knowledge/`.

**The rule: if the claim belongs to somebody else's system, fetch that system's own documentation
in this session and write from what it says.**

## When this is not optional

| Situation | Why memory fails |
| :--- | :--- |
| Naming a config key, flag, option, parameter or endpoint | renamed between minor versions constantly |
| Stating a limit, quota, default or timeout | tuned silently by the vendor |
| Writing a command or install line | flags move, subcommands get replaced |
| Anything about a pre-1.0 or beta dependency | the surface is unstable by definition |
| Version-specific behaviour ("since 3.2 …") | the exact boundary is rarely what you remember |
| A statute, standard or spec clause number | numbering shifts across revisions |

Skip the fetch only when the claim is conceptual and version-free ("HTTP is stateless"), or when
the owner supplied the documentation and you are reading it.

## How to fetch, in priority order

1. **The system's own current documentation**, at its canonical URL. Vendor docs beat every
   secondary source, including a well-written blog post and including this project's memory of it.
2. **A documentation tool, if this project has one configured** — an MCP docs server (Context7 and
   similar) resolves a library name to its indexed docs and is cheaper than crawling a site. Check
   what is available rather than assuming; when nothing is configured, fetch the URL directly.
3. **The source repository** — the changelog, release notes, and the actual signature in the code —
   when the docs are silent or lag the release.
4. **Never a search-result snippet.** Snippets strip version context, which is the only thing that
   made the fact worth checking.

Fetch narrowly: the page for the thing you are documenting, not the whole site. Two or three
targeted fetches beat a crawl, and they leave a trail a reviewer can follow.

## What to record

Every external claim in `knowledge/` carries three things:

- **What it says** — copied exactly, especially names and values. Do not tidy a flag's spelling.
- **Which version it is true of** — the release, edition, revision or "as at" date. A statement
  about a moving system with no version attached is not checkable and will quietly rot.
- **Where it came from** — the URL or document title, in the markdown, where a reader can follow it.

If the documentation is ambiguous or contradicts itself, that is a finding for the owner, not
something to resolve by picking the reading that fits the sentence you wanted to write.

## When the fetch fails

Offline, rate-limited, page moved, docs behind a login — all normal. None of them is a licence to
proceed from memory. Say what you could not verify, leave the claim out or explicitly marked, and
name the page the owner needs to open. An unverified claim announced is cheap; an unverified claim
merged is expensive.
