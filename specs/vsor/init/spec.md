---
status: draft
date: 2026-08-13
---

# `vsor init` — the scaffold

**Business claim:** ownership-by-scaffold. The user's project is theirs from minute 0 — every file
answerable, nothing frozen, nothing rented. The primary caller is an unattended agent on a machine
we know nothing about; every behavior below is decided for that caller.

## Observable contract

Three argument forms exist; anything else is `error: bad-name`, exit 1:

- `vsor init <name>` — scaffold into `<name>/`. **Name grammar:** `^[a-z0-9][a-z0-9-]{0,62}$` —
  one path segment; no dots, slashes, `..`, or absolute paths; parents are never created.
  Violation: exit 1, error states the rule and suggests the slugged form. At slice 2 the name
  becomes the MCP tool brand via one deterministic transform (hyphen → underscore), recorded here;
  `instance-format` points here.
- `vsor init .` — scaffold the cwd; `name` = cwd basename through the same grammar (on failure the
  error says to pass an explicit name).
- `vsor init` — **never scaffolds.** Prints one instructional screen (pick a lowercase name, run
  `vsor init <name>`; or `vsor init .` in an empty directory) and exits 0. Same for humans and agents.

Both forms create **exactly**:

| Path | Content |
| :--- | :--- |
| `instance.md` | valid per `specs/vsor/instance-format`; frontmatter = the required trio only (`format`, `name`, `vsor.requires` — reserved keys stay documented there, never scaffolded); body = a short real starter prompt naming the corpus, the abstention rule, and citations |
| `knowledge/example.md` | ONE real document. Frontmatter contract, held here until a knowledge-format spec supersedes it: `title:` required, `description:` optional; the origin-artifact block is reserved for `add-sources` |
| `site/docusaurus.config.ts` | targets `@docusaurus/preset-classic`, resolved by the framework-managed Node runtime (this spec depends on the Node-spike outcome); title = `<name>`, navbar = title only, footer = `© <year> <name>` — the owner's, never vsor's. All live seams |
| `site/src/css/custom.css` | design tokens, **including `--ifm-color-primary`** (Docusaurus-native path — see ratification note 2) |
| `site/src/pages/index.tsx` | the homepage (Docusaurus-native path) |
| `.agents/skills/add-sources/SKILL.md` | content authority: `templates/` alone, until `specs/vsor/add-sources` is ratified |
| `AGENTS.md` | documents ONLY verbs implemented at the stamped version (others appear as "arrives at <version>" pointers — never present tense); the exit-code table below, stated explicitly because it diverges from eve's exit-2 convention; the `.env` precondition before `build`/`serve`; the line "before adding sources, read `.agents/skills/add-sources/SKILL.md`"; the docs locator (installed package `docs/`, web URL fallback); "secrets go in `.env`, never in command arguments" |
| `CLAUDE.md` | exactly `@AGENTS.md` + newline — the alias Claude Code loads; AGENTS.md stays the single source |
| `.env` | exactly two empty-value placeholders — permanent API, providers post-v0 ADD keys, never rename: `DATABASE_URL=` (`# any Postgres DSN — Neon free tier works`) and `GEMINI_API_KEY=` (`# your Gemini API key — aistudio.google.com/apikey`). Mode 0600 |
| `.gitignore` | `.vsor/` · `build/` · `.env` · `.DS_Store` |
| `.git/` | fresh path only — see **Git** |

**Content authority:** canonical bytes live in `templates/`; init output is byte-identical after
stamping exactly two values — name and version. The scaffold test diffs output against `templates/`
(success stdout included).

**Negative contract (equally binding):** no `governance/`, `evals/`, `reflexes/`, `packages/`,
`gateways/`, `node_modules/`, `pyproject.toml`, `package.json`; **no empty directories outside
`.git/`**. Init performs **no network I/O**, emits no telemetry, and is **deterministic**: same
version + same name ⇒ byte-identical trees outside `.git/`. **All machinery scratch in later verbs
— caches, managed runtimes, intermediate site state — lands under `.vsor/`** (binds the site/build
specs; makes the four ignore lines provably sufficient). **Platform:** v0 is macOS/Linux; on
Windows, exit 3 `error: unsupported-platform`, remedy names WSL.

**Target acceptance — one rule for both forms:** a target (named or `.`) that is empty or contains
only allowlisted entries is accepted. Allowlist, exact: `.git/`, `.gitignore`, `.gitattributes`,
`README.md`, `LICENSE*`, `.DS_Store`, `.nvmrc`, `.node-version`, `.python-version`,
`.tool-versions`, `.editorconfig`, `.vscode/`, `.idea/`. Anything else: exit 1 `error: blocked`,
naming the first five blockers lexicographically + "and N more" + the remedy. A target holding a
valid `instance.md`: `error: exists` — "already a vsor project — nothing to do; next: `vsor dev`".
An `instance.md` anywhere on the target's ancestor path: `error: nested`, naming the path.

**The one permitted modification of an existing file:** an existing `.gitignore` is merged — init
appends its four lines idempotently inside a `# vsor` marker block and verifies `.env` is ignored
afterwards. Every other collision with a scaffold-owned path is a blocker; init never modifies or
deletes any other existing file.

**Atomicity:** the named form stages the complete tree (git commit included) in a same-filesystem
sibling temp directory and renames into place only on total success. The in-place form writes
`.gitignore` first and `instance.md` last, removing exactly the paths it created on failure.
**A failed init leaves the filesystem as it found it; retrying is always safe.**

**Git:**

- **Fresh target** (not inside an existing work tree): `git init -b main` (the user's configured
  `init.defaultBranch` wins), then ONE commit of exactly the table's files minus `.env` (on disk,
  ignored), message `vsor init <name> (vsor <version>)`, run with `--no-gpg-sign --no-verify`, and
  — only when committer identity is unset — per-invocation `-c user.name=vsor
  -c user.email=init@vsor.local`. The user's global config is never written.
- **Inside an existing work tree** (`git rev-parse --git-dir` from the target; worktrees count): no
  `git init`, nothing staged, nothing committed; stdout says the enclosing repo's owner reviews and
  commits. The one-commit promise applies only to the fresh path.
- **`git` binary absent:** the scaffold completes; the git step is reported skipped with the
  reason; exit 0.

**Version pinning:** the one contract value is the running distribution version
(`importlib.metadata.version("vsor")`). `vsor.requires` derives from it by one rule (ratification
note 1). A version that is missing, `0.0.0`, or carrying a dev/pre segment refuses — exit 3,
`error: unstamped`, naming the packaging defect — unless `VSOR_DEV_VERSION=<x.y.z>` is set by the
dev/CI harness (the Makefile exports it), whose value is then pinned. No filesystem sniffing, ever.

**Output contract:**

- Exit codes: **0** success (including git-skipped and the bare form) · **1** refused (exists /
  blocked / bad-name / nested) · **2** reserved — unimplemented verb (repo convention) · **3**
  environment/packaging (unsupported-platform, unstamped).
- Errors go to stderr; the **first line is a stable slug** — `error: exists | blocked | bad-name |
  nested | unsupported-platform | unstamped`. Prose below carries the remedy and may change freely.
- Success stdout (canonical in `templates/`) ends with the handoff: the project path, then
  `cd <name>` · read `AGENTS.md` · the add-sources skill path · `vsor dev` when ready.

**No prompts.** Init asks nothing. (`--with-source` is specified in `specs/vsor/eject`.)

## Acceptance

Verbatim, from the repo root; CI runs it with networking disabled. Post-publish, `uvx vsor`
replaces `uvx --from packages/vsor vsor`.

```bash
uvx --from packages/vsor vsor init demo > out.txt
grep -q 'AGENTS.md' out.txt && grep -q 'vsor dev' out.txt            # the pinned handoff
diff <(find demo -path demo/.git -prune -o -type f -print | LC_ALL=C sort) - <<'EOF'
demo/.agents/skills/add-sources/SKILL.md
demo/.env
demo/.gitignore
demo/AGENTS.md
demo/CLAUDE.md
demo/instance.md
demo/knowledge/example.md
demo/site/docusaurus.config.ts
demo/site/src/css/custom.css
demo/site/src/pages/index.tsx
EOF
test -z "$(find demo -not -path 'demo/.git*' -type d -empty)"        # no empty dirs outside .git/
test "$(git -C demo log --oneline | wc -l)" -eq 1                    # the one commit
test "$(git -C demo symbolic-ref --short HEAD)" = "main"
git -C demo check-ignore -q .env                                     # .env on disk, ignored…
test -z "$(git -C demo status --porcelain)"                          # …everything else committed
uvx --from packages/vsor vsor init demo 2>err; test $? -eq 1
grep -q '^error: exists' err
uvx --from packages/vsor vsor init 'My SoR' 2>err; test $? -eq 1
grep -q '^error: bad-name' err
mkdir blank && uvx --from packages/vsor vsor init blank              # empty named target accepted
git init -q -b main parent && (cd parent && uvx --from packages/vsor vsor init notes)
test ! -e parent/notes/.git                                          # no nested repo…
test "$(git -C parent log --oneline 2>/dev/null | wc -l)" -eq 0      # …no commit into the parent
mkdir gh && touch gh/README.md gh/.DS_Store
printf 'node_modules/\n' > gh/.gitignore && git init -q gh
(cd gh && uvx --from packages/vsor vsor init .)                      # the fresh-GitHub-clone path
grep -q 'node_modules/' gh/.gitignore                                # existing ignores merged…
git -C gh check-ignore -q .env                                       # …and .env still ignored
mkdir A B && (cd A && uvx --from packages/vsor vsor init demo) && (cd B && uvx --from packages/vsor vsor init demo)
diff -r --exclude=.git A/demo B/demo                                 # deterministic bytes
uvx --from packages/vsor vsor init                                   # bare form: exit 0, no scaffold
```

Unit-tier (deterministic, not shell): atomicity via fault injection — a mid-write failure leaves
no target; forced placeholder version without `VSOR_DEV_VERSION` → exit 3 `error: unstamped`;
`.env` mode 0600; git-absent path (PATH scrubbed) → scaffold complete, exit 0, skip reported.

When `build` lands: the unedited scaffold passes `vsor build` with zero edits (site half) under the
stock classic preset with zero plugin-path overrides, and that test is added here in the same change.

## Out of scope

Skill content (`specs/vsor/add-sources`) · `--with-source` and ejection (`specs/vsor/eject`) ·
template/theme selection (post-v0) · any interactive question (never — settled decision 1) ·
`--json` on init at v0 — agents branch on exit codes and the stderr slug; an envelope arrives with
`info --json` post-v0 · Windows beyond the named refusal · knowledge frontmatter beyond the two
keys held here.

## Open for ratification

1. **`vsor.requires` floor rule** — running `X.Y.Z` writes either **(a) `>=X.Y.Z,<X.(Y+1)`
   (RECOMMENDED** — an older cached patch of vsor can otherwise satisfy the pin while the
   scaffold's stamped docs reference newer behavior — the exact drift `vsor.requires` exists to
   catch**)** or (b) `>=X.Y,<X.(Y+1)`, matching instance-format's current example. Either way,
   instance-format's `requires` row becomes a pointer to this rule (one fact, one file).
2. **Docusaurus-native `site/` layout** — this spec scaffolds `site/src/css/custom.css` and
   `site/src/pages/index.tsx`, superseding the flat tree in AGENTS.md's scaffold section
   **(RECOMMENDED** — the flat layout contradicts settled decision 11's own "seams agents know from
   training data" rationale and the already-settled `site/src/theme/` swizzle destination, and the
   stock preset silently ignores root-level files**)**. The ratifying commit must carry the
   AGENTS.md revision note (src/ paths, `CLAUDE.md` row, `.DS_Store` ignore line) — supersession
   visible, same commit.
