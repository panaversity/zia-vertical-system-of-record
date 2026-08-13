# sor-site — the website surface

The Node side of the framework: everything that turns a governed corpus into a static site.
**The contract is [`specs/sor-site/surface/spec.md`](../../specs/sor-site/surface/spec.md)** — its
negative contract (no auth, no tutor/AI panels, no progress backends, no analytics, no external
requests from the theme) is binding and CI-enforced; read it before adding anything here.

## Workspace layout

| Package | Name | Job |
| :--- | :--- | :--- |
| `mdx/` | `@vsor/sor-site-mdx` | the MDX vocabulary (`<Quiz />`, `<Flashcards />`, `<ConversationGallery />`, `<ExerciseCard />`, `<HighlightTip />`, ImageZoom) plus the Docusaurus theme entry that maps it into `@theme/MDXComponents` — works on **stock** `@docusaurus/preset-classic` with no other theme |
| `theme/` | `@vsor/sor-site-theme` | the visual layer — restyles the vocabulary, never changes its contract |
| `lib/*` | `@vsor/lib-*` | the content-pipeline packages (remark plugins, loaders, site plugins) |

Components are **extracted from the upstream app at the pinned survey SHA**
(see `docs/extraction.md`), stripped per the spec's exclusion table, and de-branded — never
re-implemented as lookalikes.

Node >= 20, npm workspaces, `package-lock.json` committed.
