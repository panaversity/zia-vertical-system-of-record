---
name: find-skills
description: Find and install an existing agent skill from the open skills ecosystem instead of writing one — searching by task, judging what comes back, and vetting it before it lands in this project. Use when a needed capability sounds general (a file format, a framework, a review workflow) rather than specific to this corpus.
---

# Finding an existing skill

Before writing a skill, check whether someone has already written it. General capabilities — a file
format, a language ecosystem, a review workflow — usually exist already and are better maintained
than anything written in an afternoon. Anything specific to *this* corpus almost certainly does
not exist, and should be written here instead: see `.agents/skills/skill-creator/SKILL.md`.

## Search

The open skills ecosystem is a registry at **skills.sh**, browsable by task and by publisher, and
installable with one command:

```bash
npx skills add <skill-name>              # as named on skills.sh
npx skills add vercel-labs/agent-skills  # everything a publisher ships
npx skills add https://skills.sh/p/<id>  # a pack
```

Check `npx skills add --help` and the registry's own `/docs/cli` for anything beyond `add` —
that surface moves, and a command remembered from six months ago is a command that has been
renamed. (Verified against skills.sh, 2026-08-14: `add` and those three forms; the site's CLI
reference documents nothing else.)

Search by the **task**, not the tool: "spreadsheet extraction" rather than "openpyxl", "pdf tables"
rather than the library you assume it uses. Try two or three phrasings — vocabulary differs from
one publisher to the next — and if nothing lands in three tries, nothing is there.

## Judge what comes back

A skill is not a library. It is instructions your agent will follow, in your repository, without
anyone reading them again. Treat installing one as a dependency decision:

- **Read the SKILL.md in full before installing.** Every line of it will act on this project.
- **Check who publishes it** and whether it is maintained. An unmaintained skill teaching a moving
  API is worse than no skill.
- **Refuse anything that sends content anywhere.** This corpus does not leave this machine unless
  the owner sends it. A skill that posts to an API, uploads a file, or "shares results" is not
  installable here.
- **Refuse destructive automation** — bulk deletes, force pushes, unattended rewrites of
  `knowledge/`.
- **Check it against this project's rules.** A skill that tells an agent to fill gaps with general
  knowledge, or to write claims without a source, contradicts `.claude/rules/abstention.md` and
  `.claude/rules/provenance.md`. Those rules win. Either the skill is adapted on the way in, or it
  stays out.

## Present, do not install silently

Bring the owner: what the skill does, who publishes it, what it will be allowed to touch, and the
one-line install command. Installing an outside skill into a governed project is the owner's call,
not a convenience you extend on their behalf.

## When nothing fits

Say so plainly, then do the work directly. If it turns out to be a job this project repeats, that
is the moment to write a local skill — sized to this corpus, obeying its rules, and owned here.
