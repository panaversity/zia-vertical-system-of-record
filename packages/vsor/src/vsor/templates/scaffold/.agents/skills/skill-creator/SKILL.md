---
name: skill-creator
description: Write, improve and test a skill for this project — the SKILL.md anatomy, the description that actually triggers it, and the small evaluation loop that proves it beats working without it. Use when a job here has been done twice the same way, when an existing skill misfires or never triggers, or when the owner asks for a new skill.
---

# Writing a skill

A skill is a job this project does often enough, and specifically enough, that the right way to do
it should not be re-derived every session. That is the whole test. Two identical corrections from
the owner is the signal; one interesting session is not.

**Do not write a skill whose content is "think harder" or "be careful".** A skill earns its place
by carrying a *non-obvious fact* — a path, a contract, a format, a trap that costs an hour — or a
*guardrail against an irreversible mistake*. A checklist that only re-states good judgment makes
every future session heavier and no session better.

## Anatomy

```
.agents/skills/<skill-name>/
└── SKILL.md          ← frontmatter + instructions; the whole skill in most cases
```

```yaml
---
name: skill-name              # matches the directory
description: What it does, and when to use it — in the words someone would actually say.
---
```

Keep the body under about 500 lines. If it grows past that, the skill is probably two skills, or
its reference material belongs in a sibling file (`references/…`) that the SKILL.md points to and
the agent reads only when it needs it.

## The description is the trigger

This is the part that decides whether the skill is ever used, and it is the part most often written
carelessly. It must say **what the skill does and in which situations** — including the phrasings a
real person uses.

> **Weak**: "Helps with document conversion."
> **Strong**: "Convert a Word document (.docx) into governed markdown for knowledge/ — faithful
> extraction, tracked changes, tables. Use whenever a source arrives as .docx, a Word export, or
> when checking a converted document against its original."

Skills are under-triggered far more often than over-triggered, so lean specific and slightly
insistent. Name the file types, the verbs, the moments. Do not hide the "when" inside the body: by
then the decision to load has already been made.

## Writing the body

- **Imperative, and concrete.** "Run X, read Y, then decide Z" beats "consider whether".
- **Say why.** A rule with its reason survives contact with a case its author did not foresee; a
  bare MUST gets worked around.
- **Show the shape of the output** — the exact template, the exact props, an example that would
  pass review.
- **Name the failure modes** you already hit. The trap you burned an hour on is worth more than
  three paragraphs of best practice.
- **Never encode a number you did not measure.** A threshold copied from another project is a
  number nobody here checked. If you measured it, write the date and the method next to it.
- **Never instruct an agent to write unsourced content.** Any skill that touches `knowledge/` obeys
  `.claude/rules/provenance.md` and `.claude/rules/abstention.md`; say so where it matters.

## Test it before you believe it

Two or three prompts a person here would actually type — not idealised ones.

1. Write them down first, and show the owner. Prompts you invent after seeing the skill work are
   not tests.
2. Run each in a fresh session **with** the skill, and once **without** it. The comparison is the
   only thing that tells you whether the skill is carrying weight or just adding tokens.
3. Read the outputs against what you wanted, and against the corpus rules — did the skill's advice
   survive a real case?
4. Rewrite the two weakest instructions; run again. Two iterations usually settles it. If three do
   not, the skill is trying to encode judgment that does not compress.

When improving an existing skill, keep a copy of the old version as the baseline for step 2 —
"it feels better" is not a result.

## Safety

A skill is instructions an agent will follow without a human reading them again. So: nothing
destructive without an explicit confirmation step, nothing that sends this project's content
anywhere, no credentials, no commands that reach outside the project directory. A skill's contents
should hold no surprises for someone who read only its description.

## Before it lands

- [ ] The job has repeated, and the skill carries facts rather than exhortation
- [ ] `name` matches the directory; `description` names both what and when
- [ ] Body is imperative, shows the output shape, names the traps
- [ ] Any number in it was measured here, with date and method
- [ ] Tested with and without, on prompts written before the runs
- [ ] Nothing destructive, nothing that phones anywhere
- [ ] Listed in `AGENTS.md` so a reader knows it exists
