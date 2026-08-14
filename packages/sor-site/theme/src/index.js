/**
 * @vsor/sor-site-theme — Docusaurus theme entry.
 *
 * Native seams only: the standard theme API (getThemePath, getClientModules,
 * configurePostCss), so every component lands at @theme/<Name> and
 * `docusaurus swizzle` --wrap/--eject work exactly as agents already know from
 * training data. No invented indirection.
 *
 * Components provided (all copied from ag2 apps/learn-app at d764f334,
 * stripped per specs/sor-site/surface/spec.md, de-branded):
 *   @theme/DocItem/Content  — wrap-only enhancement (via @theme-init) that
 *                             mounts ReadingProgress + DocPageActions +
 *                             LessonContent around the stock doc content
 *   @theme/LessonContent    — the doc-page primitive (Full Text / Summary tabs)
 *   @theme/DocPageActions   — corpus-neutral page actions (copy/download/share)
 *   @theme/ReadingProgress  — local scroll indicator (no backend)
 *   @theme/SearchBar        — command-palette UI over the LOCAL search index
 *                             (shadows the @easyops-cn/docusaurus-search-local
 *                             SearchBar when this theme is listed after it;
 *                             requires that theme with `hashed: false` so
 *                             /search-index.json exists at a stable path)
 *   @theme/ModeToggle       — pure Docusaurus color-mode toggle, mounted by the
 *                             Navbar below (desktop bar and mobile sheet)
 *   @theme/Navbar           — the site's top bar: brand from @theme/Logo, links
 *                             from themeConfig.navbar.items, local search,
 *                             color mode, and a mobile sheet that carries the
 *                             doc tree. A full swizzle, which is why B12 (seam
 *                             liveness) is load-bearing
 *   @theme/Footer           — link columns, brand and copyright, all from
 *                             themeConfig.footer + siteConfig.title
 *
 * Deliberately NOT provided — recorded so the next reader does not re-derive it
 * (surface spec names Layout and Root as chrome that crosses; at the pinned SHA
 * there was nothing left in either after the negative contract applied):
 *   Layout — upstream's swizzle is a 17-line wrapper whose only job is mounting
 *            one excluded product banner. A pass-through wrapper would be a file
 *            that does nothing, in a package whose point is that nothing hides
 *            in it. Stock @theme/Layout renders this theme's Navbar and Footer.
 *   Root   — upstream's is a stack of excluded providers around one kept mount,
 *            the image lightbox, which already crosses in @vsor/sor-site-mdx's
 *            own Root. Shipping a second Root here would SHADOW that one (this
 *            theme is listed after the mdx theme) and silently drop it.
 *
 * The design system (spec amendment 2026-08-13) ships from src/css and src/ui:
 * Tailwind v4 + shadcn/ui primitives over an OKLCH token layer. Two mechanisms
 * below make it work with NO postcss config in the user's project — the
 * machinery-invisible rule (AGENTS.md settled decision 11):
 *
 *   1. configurePostCss(): the theme adds Tailwind's postcss plugin and
 *      autoprefixer to the site's pipeline itself.
 *   2. the generated entry: Tailwind must be told, per build, where the
 *      consuming site's own source lives. See writeTailwindEntry().
 *
 * src/ui holds ONLY the shadcn primitives the chrome above actually imports —
 * today `button` and `sheet`. That is a rule, not an accident: this package's
 * point is that nothing hides in it, so an unused primitive is a defect, not a
 * convenience. Adding one is two steps, both cheap: copy the canonical shadcn
 * file into src/ui (rewriting its `@/lib/utils` import to `../lib/utils`) and
 * add its `@radix-ui/react-*` package to this package's dependencies AND to the
 * surface spec's allowlist in the same reviewed change.
 */
const fs = require("node:fs");
const path = require("node:path");

const CSS_DIR = path.resolve(__dirname, "./css");
const TOKENS_CSS = path.join(CSS_DIR, "tokens.css");
const TAILWIND_CSS = path.join(CSS_DIR, "tailwind.css");
// The chrome stylesheets: sidebar nav, then doc layout and prose typography.
// Last in the entry, and deliberately UNLAYERED, so they win over Tailwind's
// preflight and utilities the way upstream's own doc CSS does.
const CHROME_CSS = [
  path.join(CSS_DIR, "sidebar.css"),
  path.join(CSS_DIR, "docs.css"),
];

/** CSS specifiers are posix, whatever the platform's path separator is. */
function toSpecifier(from, to) {
  const rel = path.relative(from, to).split(path.sep).join("/");
  return rel.startsWith(".") ? rel : `./${rel}`;
}

/**
 * Write `<siteDir>/.docusaurus/vsor-sor-site-theme/entry.css` — the stylesheet
 * the site actually loads. It imports this package's stylesheets in cascade
 * order (tokens, then Tailwind, then the unlayered chrome: sidebar and doc
 * typography) and adds the one thing a shipped file cannot know: where the
 * consuming site's own source is on disk.
 *
 * Why this exists (src/css/tailwind.css carries the full argument): Tailwind
 * decides what to emit by scanning files, and its automatic detection skips
 * node_modules and .gitignore'd paths, rooted at whatever `process.cwd()`
 * happens to be. A vsor site is installed into node_modules, lives under a
 * gitignored `.vsor/`, and is built with cwd set to the shell root — so the
 * heuristic is being asked to guess, every build, what the site's appearance
 * depends on. These two lines stop it guessing.
 *
 * found live 2026-08-14 (docusaurus 3.10.2, tailwind 4.3.3, themed fixture
 * built against this package UNPACKED INTO node_modules, i.e. the real `vsor
 * build` layout): the built stylesheet carries the utilities the site and the
 * theme actually use — `.bg-primary{background-color:var(--primary)}`, the
 * `docs:` breakpoint variants the navbar needs, the sheet's enter/exit
 * animations — and a browser reads real computed values off them in both
 * themes (bg-card → rgb(255,255,255) light / rgb(18,18,18) dark).
 *
 * Idempotent by content: rewritten only when it would change, so `vsor dev`'s
 * watcher does not see a fresh mtime on every reload.
 */
function writeTailwindEntry(context) {
  const outDir = path.join(context.generatedFilesDir, "vsor-sor-site-theme");
  const entry = path.join(outDir, "entry.css");

  // The site's authored source, and the corpus beside it — `knowledge/` is a
  // sibling of `site/` in the scaffold, in the built shell, and in the e2e
  // harness alike. Markdown counts: an .mdx doc can carry className too.
  const sources = [
    path.join(context.siteDir, "src"),
    path.resolve(context.siteDir, "..", "knowledge"),
  ].filter((dir) => fs.existsSync(dir));

  const body = [
    "/* Generated by @vsor/sor-site-theme on every build — do not edit, do not commit.",
    " * Exists so Tailwind can be told where this site's own source lives; see",
    " * writeTailwindEntry() in the theme package for why that cannot be shipped. */",
    `@import "${toSpecifier(outDir, TOKENS_CSS)}";`,
    `@import "${toSpecifier(outDir, TAILWIND_CSS)}";`,
    ...CHROME_CSS.map((file) => `@import "${toSpecifier(outDir, file)}";`),
    ...sources.map((dir) => `@source "${toSpecifier(outDir, dir)}";`),
    "",
  ].join("\n");

  fs.mkdirSync(outDir, { recursive: true });
  let current = null;
  try {
    current = fs.readFileSync(entry, "utf8");
  } catch {
    // no entry yet — first build in this site directory
  }
  if (current !== body) {
    fs.writeFileSync(entry, body);
  }
  return entry;
}

module.exports = function sorSiteTheme(context) {
  const tailwindEntry = writeTailwindEntry(context);

  return {
    name: "@vsor/sor-site-theme",

    getThemePath() {
      return path.resolve(__dirname, "./theme");
    },

    getClientModules() {
      // One entry, not three: it @imports the token layer and the Tailwind
      // layer, so Tailwind bundles all of it in one pass and the cascade order
      // (tokens first, utilities last) is fixed by the file rather than by the
      // order Docusaurus happens to collect client modules in.
      return [tailwindEntry];
    },

    /**
     * The whole reason a vsor project needs no postcss.config.js: the theme
     * installs Tailwind's postcss plugin into the site's own pipeline.
     * Ordering is deliberate — Tailwind first (it expands @import/@theme/@apply
     * and generates the utilities), then Docusaurus's own postcss-preset-env on
     * the result, then autoprefixer last.
     */
    configurePostCss(postCssOptions) {
      postCssOptions.plugins = [
        require("@tailwindcss/postcss")(),
        ...postCssOptions.plugins,
        require("autoprefixer")(),
      ];
      return postCssOptions;
    },

    /**
     * Transpile THIS package's own .ts/.tsx when it is installed rather than
     * linked — the second half of "the theme works the same in both layouts".
     *
     * found live 2026-08-14 (docusaurus 3.10.2): Docusaurus's own JS rule
     * excludes everything under node_modules unless the path segment after it
     * contains "docusaurus" AND the file ends .js/.jsx (excludeJS,
     * @docusaurus/core/lib/webpack/base.js:35). In the npm workspace the theme
     * resolves through a symlink that webpack realpaths back out of
     * node_modules, so every .tsx compiles and everything looks fine — but in a
     * real `vsor build` the package is INSTALLED under
     * .vsor/site-runtime/node_modules/@vsor/sor-site-theme/, and the same build
     * dies with "Module parse failed: Unexpected token" on the first `interface`
     * it meets. Proven by packing this package with `npm pack` and building
     * against the unpacked copy; the error names Footer's own type declarations.
     *
     * The sibling @vsor/sor-site-mdx package solves this by precompiling to
     * lib/ with tsc. This package cannot: its whole surface is swizzle targets,
     * and `docusaurus swizzle` copies what the theme path holds — an agent that
     * ejects Navbar should get the readable .tsx, not tsc output. So the theme
     * teaches webpack to compile its own source instead, with Docusaurus's own
     * JS loader (getJSLoader, the documented plugin util) so the transform is
     * whatever the site itself uses — babel or swc, faster or not.
     *
     * The include predicate is exact on purpose: it fires only when this file
     * sits under node_modules, which is precisely when Docusaurus's rule skips
     * it. In the workspace layout it never matches, so no file is ever handed
     * to two JS loaders.
     */
    configureWebpack(_config, isServer, utils) {
      if (typeof utils?.getJSLoader !== "function") {
        return {};
      }
      const packageSrc = __dirname;
      return {
        module: {
          rules: [
            {
              test: /\.[jt]sx?$/i,
              include: (modulePath) =>
                modulePath.startsWith(packageSrc) && modulePath.includes("node_modules"),
              use: [utils.getJSLoader({ isServer })],
            },
          ],
        },
      };
    },
  };
};
