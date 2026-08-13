---
status: draft
date: 2026-08-13
---

# `instance.md` — the deployment contract

**Business claim:** the corpus is the spec. One authored file describes the *deployment*; the
knowledge describes itself; the two are never mixed.

## Observable contract

`instance.md` sits at the project root. **YAML frontmatter is machine config; the markdown body is
the system prompt the MCP server hands every visiting agent** (consumed at slice 2; authored from
day one).

v0 frontmatter — the complete surface:

```yaml
format: 1                  # required; the only recognized value
name: my-sor               # required; identity. Becomes the tool-name brand at slice 2
vsor:
  requires: ">=0.1.5,<0.2" # exact-floor pin, derived by the rule in specs/vsor/init
                           # (one fact, one file); on mismatch: WARN + record in build.lock.json
```

Reserved for slice 2, accepted with these defaults, inert in slice 1:

```yaml
retrieval:
  vector_floor: null       # null = uncalibrated = abstention gate OFF, /health says so loudly
  keyword_floor: null
budgets:
  maximum_response_characters: 72000
```

**Strict parsing:** an unknown top-level key is a named error carrying migration guidance — never
silently ignored (the upstream binder's proven posture). **There is no `governance:` key and never
will be:** the governance level is *derived* from what exists under `governance/`, never declared.
Site branding lives in `site/` (real Docusaurus seams), not here.

## Acceptance

```bash
vsor build   # parses the scaffold's instance.md; any error names field, file and fix
```

Unit-tested: the scaffold's file round-trips · unknown key → named error with guidance · missing
`format` → error · body text preserved byte-exact for the slice-2 server.

## Out of scope

Governance registers (ladder, level 1+) · site branding (lives in `site/`) · multi-corpus /
`corpus_id` (post-v0) · hard version re-exec (open — v0 warns).
