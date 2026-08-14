# What lives where

One rule holds the whole layout together: **content in `knowledge/`, presentation in `site/`,
nothing authored under generated directories.** Changing how a page looks can never change what
is true, and that is on purpose.

| Path | What it is | Who edits it |
| :--- | :--- | :--- |
| `knowledge/` | the corpus — governed markdown, the single source of truth for every surface | you and the owner, carefully |
| `instance.md` | frontmatter is machine config; the body is the prompt the MCP surface serves | the owner, rarely |
| `site/docusaurus.config.ts` | title, navbar, footer, which themes are on — all live seams | freely |
| `site/src/css/custom.css` | the design tokens, including `--ifm-color-primary` | freely |
| `site/src/pages/index.tsx` | the homepage | freely |
| `.agents/skills/` | how to do a job here — loaded by reading the `SKILL.md` | when a job repeats |
| `.claude/rules/` | how to work in this project at all | rarely, and with the owner |
| `.env` | `DATABASE_URL` and the embedding key — git-ignored | the owner only |
| `build/`, `.vsor/`, `build.lock.json` | generated | nobody |

## The seams worth knowing

- **`knowledge/` is the input to everything.** The website and the MCP surface are both compiled
  from it. There is no second place to fix a fact, and no surface-specific copy of the content.
- **`site/` is a real Docusaurus site**, not a vsor invention. `docusaurus.config.ts`, the
  `--ifm-*` tokens and `docusaurus swizzle` work the way they do everywhere else — which is the
  point: nothing here needs a framework-specific manual.
- **The machinery is installed, not copied.** The site runtime lands under `.vsor/` on the first
  `vsor dev` or `vsor build`, and is replaced on every later invoke — so an edit made there is
  gone by the next command. Everything the project owns is already in the tree above.
- **A document's path is its identity.** Renaming a file in `knowledge/` changes its URL and its
  citation. Rename deliberately, and tell the owner when you do.
