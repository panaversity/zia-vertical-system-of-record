/**
 * The runtime shell's Docusaurus configuration.
 *
 * Lineage: ag2 apps/learn-app/docusaurus.config.ts at d764f334, 1,188 lines.
 * What was deleted (each item is a row of the negative contract in
 * specs/sor-site/surface/spec.md; the excluded keys and identifiers are
 * deliberately not spelled out here, because the boundary test scans this
 * source for exactly those names):
 *
 *   - all twelve product-service endpoints and every environment variable that
 *     fed them, along with the config key that exposed them to the client;
 *   - the head-tag payload: the hostname-sniffing publisher switch, the two
 *     third-party measurement scripts, the assistant script, the icon CDN and
 *     the webfont links — the shell initiates no off-origin request, so the
 *     only <head> addition left is a same-origin icon;
 *   - i18n: the locale config, the six parallel `plugin-content-docs`
 *     instances for translated doc trees, and the flags that switched them;
 *   - the marketing navbar and footer (product routes, social columns,
 *     publisher links) — replaced by neutral defaults a consuming project
 *     overrides through `themeConfig`;
 *   - the bespoke sidebar generator that hardcoded ~50 document ids of one
 *     specific corpus into five named groups;
 *   - the webpack shim for the in-browser interpreter;
 *   - the vendor measurement plugin.
 *
 * What crossed unchanged, because it is machinery rather than product: the
 * `future.v4` + `faster` build flags, mermaid, the local search
 * index, the sitemap, and the content-pipeline plugin chain — now resolved from
 * this repo's own de-branded `lib/*` packages rather than upstream's `libs/`.
 *
 * The corpus lives at `../knowledge`, a sibling of this shell. That is the same
 * relationship the scaffold, the built runtime and the e2e harness all use.
 */
import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";
import * as fs from "fs";
import * as path from "path";

process.env.BROWSERSLIST_IGNORE_OLD_DATA ??= "1";

/**
 * The corpus. A sibling directory by default so this shell and the knowledge it
 * publishes stay separable; `VSOR_KNOWLEDGE_DIR` lets a build point at a corpus
 * somewhere else without editing a file that ships.
 */
const KNOWLEDGE_DIR = process.env.VSOR_KNOWLEDGE_DIR || "../knowledge";

/**
 * The consuming project's authored `site/` — the other sibling, and the only
 * place a project's identity is allowed to come from. This shell ships a
 * complete, neutral default for everything below; each seam then looks for the
 * project's version of the same thing and puts it LAST, so the project wins
 * without editing (or even reading) a file inside the shell.
 *
 * Every lookup is existence-guarded, so a shell with no project beside it — the
 * fixture builds, the e2e harness — builds exactly as it did before this seam
 * existed.
 */
const SITE_DIR = process.env.VSOR_SITE_DIR || "../site";
const sitePath = (...parts: string[]) => path.resolve(__dirname, SITE_DIR, ...parts);
const ifPresent = (...parts: string[]): string[] =>
  fs.existsSync(sitePath(...parts)) ? [path.join(SITE_DIR, ...parts)] : [];
/**
 * The other override shape: not "append the project's after ours" but "use the
 * project's INSTEAD of ours". Applies where a single path is all Docusaurus
 * accepts — the sidebar file and the pages directory.
 */
const siteOr = (fallback: string, ...parts: string[]): string =>
  fs.existsSync(sitePath(...parts)) ? path.join(SITE_DIR, ...parts) : fallback;

/**
 * Identity. Every one of these is a value a consuming project replaces; none of
 * them names anything but this shell itself.
 */
const SITE_TITLE = process.env.VSOR_SITE_TITLE || "Knowledge Base";
/** The shell's own default copyright line — see followTitle() at the bottom. */
const shellCopyright = (title: string) =>
  `Copyright © ${new Date().getFullYear()} ${title}.`;
const SITE_TAGLINE =
  process.env.VSOR_SITE_TAGLINE || "One source of record, published as a site.";
const SITE_URL = process.env.VSOR_SITE_URL || "http://localhost:3000";
const BASE_URL = process.env.VSOR_BASE_URL || "/";

/**
 * Imagery. A path, not a file: the project drops its own `static/img/favicon.svg`
 * (and `static/img/og.png`) into its `site/static/`, which `staticDirectories`
 * below copies over this shell's after the shell's own — same path, project's
 * bytes. Nothing in the shell needs to know the project's file exists.
 */
const FAVICON = process.env.VSOR_FAVICON || "img/favicon.svg";
const SOCIAL_IMAGE = process.env.VSOR_SOCIAL_IMAGE || FAVICON;

/**
 * The remark chain: the collapsed tabs plugin registered once per tab
 * vocabulary, then the co-located data injectors, then the frontmatter-driven
 * enhancements.
 *
 * It opens with NO directive parser, and that is the load-bearing fact about
 * this array. Docusaurus 3.10's mdx loader parses `:::` itself; adding a second
 * directive extension — `remark-directive`, which upstream needed on 3.9 —
 * silently un-handles admonitions, so every `:::tip` in a corpus renders as the
 * literal text `:::tip` with a green build (see the found-live note inside the
 * array, and Acceptance B16).
 *
 * Upstream registered five near-identical tab plugins here — one per
 * vocabulary, each a copy of the same transform. They are one plugin now, and
 * the vocabulary is the config below: a project that wants different tabs edits
 * this array and writes no code.
 */
const remarkTabs = require("@vsor/lib-remark-tabs");
const tabPresets = require("@vsor/lib-remark-tabs/presets");

const remarkPlugins = [
  // found live 2026-08-14: upstream (Docusaurus 3.9) required remark-directive
  // here. On 3.10 the mdx loader parses directives itself, and a SECOND
  // directive extension in the chain silently un-handles admonitions — `:::tip`
  // renders as the literal text `:::tip` on every page. Docusaurus's own pass
  // still produces the containerDirective nodes remark-tabs below consumes, so
  // the plugin is removed rather than pinned, and removed from the dependency
  // allowlist too (tests/test_surface_contract.py) so nothing reads as an
  // invitation to add it back.
  [remarkTabs, tabPresets.osTabs],
  require("@vsor/lib-remark-flashcards"),
  require("@vsor/lib-remark-gallery"),
  [require("@vsor/lib-remark-content-enhancements"), { enableSlides: true }],
];

const beforeDefaultRemarkPlugins = [
  require("@vsor/lib-remark-normalize-relative-links"),
];

const config: Config = {
  title: SITE_TITLE,
  tagline: SITE_TAGLINE,
  favicon: FAVICON,

  url: SITE_URL,
  baseUrl: BASE_URL,
  // Left at Docusaurus's default (undefined) rather than upstream's `false`, and the
  // reason is the deployable output, not taste: `false` emits `docs/example.html`,
  // which only a host that rewrites extensionless URLs will serve — Vercel does,
  // nginx, S3 and `python3 -m http.server` do not. The default emits
  // `docs/example/index.html`, which every static host serves as a directory index.
  // A project deploying somewhere with its own opinion sets `trailingSlash` in its own
  // config; it is not one of the keys this shell reserves.

  // The project's assets FIRST, the shell's as the fallback behind them. A
  // project file at `static/img/favicon.svg` therefore replaces the shell's at
  // the same path, and everything the project does not supply still ships.
  //
  // The order is the opposite of the intuitive one, and it is measured, not
  // assumed (found live 2026-08-14, docusaurus 3.10.2): Docusaurus turns this
  // array into copy-webpack-plugin patterns in order
  // (webpack/plugins/StaticDirectoriesCopyPlugin.js) and that plugin defaults to
  // `force: false` — an asset already emitted by an earlier pattern is NOT
  // overwritten by a later one. First writer wins. Listing the shell first
  // silently ignored every project asset.
  staticDirectories: [...ifPresent("static"), "static"],

  onBrokenLinks: "warn",
  onBrokenAnchors: "warn",

  future: {
    v4: true,
    faster: {
      swcJsLoader: true,
      swcJsMinimizer: true,
      swcHtmlMinimizer: true,
      lightningCssMinimizer: true,
      mdxCrossCompilerCache: true,
    },
  },

  markdown: {
    mermaid: true,
    // found live 2026-08-14: Docusaurus 3 requires `:::tip[Title]`; the v2 form
    // `:::tip Title` is not a directive at all, so it renders as the literal
    // text ":::tip Title" with no warning. Corpora written for Docusaurus 2 are
    // full of it — 429 occurrences in the corpus this shell was extracted from —
    // and "bring your existing markdown" is the promise, so the shell migrates
    // the syntax on the way in rather than asking every owner to rewrite it.
    // Fenced code is left alone: a line inside ``` is content, not a directive.
    preprocessor: ({ fileContent }) => {
      let inFence = false;
      return fileContent
        .split("\n")
        .map((line) => {
          if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
          if (inFence) return line;
          return line.replace(
            /^(:{3,}\s*)(note|tip|info|warning|danger|caution)[ \t]+(?!\[)(.+?)[ \t]*$/,
            (_m, colons, kind, title) => `${colons}${kind}[${title}]`,
          );
        })
        .join("\n");
    },
  },

  // Same-origin only. The contract is that a built site initiates no off-origin
  // request, so there is nothing here but the icon this shell ships.
  //
  // `href` is composed from this shell's OWN BASE_URL here and rewritten from the
  // MERGED one by followBaseUrl() at the bottom — see the note there. This object
  // is built before the project's config is loaded, so it cannot read the value a
  // project sets.
  headTags: [
    {
      tagName: "link",
      attributes: {
        rel: "icon",
        type: "image/svg+xml",
        href: `${BASE_URL}${FAVICON}`,
      },
    },
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          path: KNOWLEDGE_DIR,
          routeBasePath: "docs",
          // The project's `site/sidebars.ts` when it wrote one, else this
          // shell's autogenerated tree. Both name the sidebar `tutorialSidebar`
          // — the ecosystem's name — so a `type: "docSidebar"` navbar item
          // keeps resolving across the swap.
          sidebarPath: siteOr("./sidebars.ts", "sidebars.ts"),
          // The corpus is the source of truth; there is no upstream repo to
          // send a reader to, so no edit link is generated.
          editUrl: undefined,
          showLastUpdateTime: false,
          showLastUpdateAuthor: false,
          // Co-located summaries are injected as frontmatter by the summaries
          // plugin; they are not pages of their own.
          exclude: ["**/*.summary.md"],
          // found live 2026-08-14: the mdx loader reads `options.admonitions ?? false`,
          // so a docs block that never names the key ships with admonitions OFF —
          // every `:::tip` in a corpus renders as the literal text `:::tip`. It is
          // stated explicitly here rather than inherited, because the failure is
          // silent: nothing warns, and the page just looks wrong.
          admonitions: true,
          beforeDefaultRemarkPlugins,
          remarkPlugins,
        },
        blog: false,
        // The homepage seam. Docusaurus takes ONE pages directory, so this is a
        // replacement rather than an overlay: a project that ships
        // `site/src/pages/` owns every non-doc route, and a project that ships
        // none gets this shell's single `src/pages/index.tsx`. Either way the
        // page can import `@theme/Landing` and `@/components/…` — the theme
        // aliases and the `@` alias are the site's, not the directory's.
        pages: {
          path: siteOr("src/pages", "src", "pages"),
        },
        theme: {
          // THE BRAND SEAM. The shell's stylesheet declares the whole token
          // layer (src/css/tokens.css); the project's stylesheet is appended
          // after it, so any token it redeclares — a brand channel, the type
          // stack, a palette entry — simply wins on cascade order. No merge
          // logic, no override verb: later stylesheet, later declaration.
          customCss: [
            "./src/css/custom.css",
            ...ifPresent("src", "css", "custom.css"),
          ],
        },
        sitemap: {
          changefreq: "weekly",
          priority: 0.5,
          filename: "sitemap.xml",
          // Route paths, and a route path CARRIES baseUrl — under `/repo/` the
          // search route is `/repo/search`, which an absolute `/search` no
          // longer matches. Written against this shell's own BASE_URL and
          // rebased from the merged one by followBaseUrl() at the bottom.
          ignorePatterns: ["**/tags/**", `${BASE_URL}search`],
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    [
      // The bare specifier, not require.resolve(): Docusaurus serializes the
      // themes array into the client bundle, so a resolved path would bake this
      // machine's absolute checkout path into every built site (found live
      // 2026-08-14 — the repo path contains a brand name, and the bundle-tier
      // brand scan caught it).
      "@easyops-cn/docusaurus-search-local",
      {
        // `hashed: false` is load-bearing, not a preference: the SearchBar in
        // src/components reads the index over fetch from a fixed path, so the
        // filename may not carry a content hash.
        hashed: false,
        language: ["en"],
        indexDocs: true,
        indexBlog: false,
        indexPages: false,
        docsRouteBasePath: "/docs",
        highlightSearchTermsOnTargetPage: true,
        searchResultLimits: 8,
        searchResultContextMaxLength: 50,
        explicitSearchResultPath: true,
        ignoreFiles: [/\.summary$/],
        searchBarShortcutHint: false,
      },
    ],
    "@docusaurus/theme-mermaid",
  ],

  plugins: [
    // No `organization` option: the plugin falls back to `siteConfig.title`,
    // which by then is the MERGED title. Passing SITE_TITLE here (the shell's
    // own default) permanently shadowed it, so every page announced itself to
    // search and answer engines as "Knowledge Base" no matter what the project
    // called itself — one page carrying two different names for one site
    // (found live 2026-08-14 by rebuilding with a renamed project).
    "@vsor/lib-plugin-structured-data",
    ["@vsor/lib-summaries-plugin", { docsPath: KNOWLEDGE_DIR }],
    ["@vsor/lib-section-manifest-plugin", { docsPath: KNOWLEDGE_DIR }],
    // `@/*` -> `src/*`, the alias upstream used and the one every component in
    // this shell is written against.
    function aliasPlugin() {
      return {
        name: "vsor-alias",
        configureWebpack() {
          return {
            resolve: {
              alias: { "@": path.resolve(__dirname, "src") },
            },
          };
        },
      };
    },
  ],

  themeConfig: {
    image: SOCIAL_IMAGE,

    colorMode: {
      respectPrefersColorScheme: true,
    },
    docs: {
      sidebar: {
        hideable: true,
      },
    },
    navbar: {
      // Read by src/theme/Navbar via @theme/Logo — the seam a consuming
      // project's own docusaurus.config.ts overrides.
      title: SITE_TITLE,
      hideOnScroll: false,
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Knowledge",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [],
      copyright: shellCopyright(SITE_TITLE),
    },
    // Set explicitly: Docusaurus's default prism theme is dark, while the doc
    // CSS paints the code surface from --muted, so leaving this unset renders
    // fenced blocks at roughly 1.3:1 in light mode (measured).
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

/* ---------------------------------------------------------------------------
 * THE CONFIG SEAM — how a project's own docusaurus.config.ts wins.
 *
 * Everything above is this shell's default. A consuming project keeps a real
 * `site/docusaurus.config.ts` beside its corpus; it is loaded here and merged
 * OVER the default, so the project never edits (or reads) a file inside the
 * shell and never restates the machinery to change a title.
 *
 * The rules, exactly:
 *
 *   - objects merge key by key, recursively; the project's value wins at every
 *     leaf. `themeConfig.navbar.title` therefore replaces just the title and
 *     leaves `hideOnScroll` alone.
 *   - ARRAYS REPLACE, they never concatenate. A project that writes
 *     `navbar.items` owns the whole list — the alternative (append) makes a
 *     shipped default impossible to remove, which is the opposite of a seam.
 *   - six keys are the shell's and are dropped from the project's file with a
 *     warning if it sets them: the ones below. They are the machinery —
 *     the corpus pipeline, the search index, the build flags, the asset
 *     layering. A project that could replace `presets` could silently drop the
 *     remark chain its own documents are written against.
 *   - every OTHER top-level key is the project's to set, including `title`,
 *     `tagline`, `url`, `baseUrl`, `favicon`, `trailingSlash`, `onBrokenLinks`
 *     and the whole of `themeConfig`.
 *
 * The other four seams are not merges and do not appear here, because they are
 * about files rather than values: `site/src/css/custom.css` is appended after
 * this shell's stylesheet (cascade order decides), `site/static/` is layered
 * ahead of this shell's, `site/sidebars.ts` replaces this shell's sidebar file,
 * and `site/src/pages/` replaces this shell's pages directory.
 *
 * The project's file is loaded with `require`, which the config loader
 * transpiles the same way it transpiled this file — so `.ts` works. It must
 * export an object (or a function returning one) synchronously; an async
 * config factory is not supported here and says so rather than half-working.
 */
const SHELL_OWNED = [
  "presets",
  "plugins",
  "themes",
  "markdown",
  "future",
  "staticDirectories",
] as const;

type Settings = Record<string, unknown>;

const isPlainObject = (value: unknown): value is Settings =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function mergeOver(base: Settings, over: Settings): Settings {
  const merged: Settings = { ...base };
  for (const [key, value] of Object.entries(over)) {
    if (value === undefined) continue;
    const current = merged[key];
    merged[key] =
      isPlainObject(value) && isPlainObject(current) ? mergeOver(current, value) : value;
  }
  return merged;
}

function projectSettings(): Settings {
  const file = ["docusaurus.config.ts", "docusaurus.config.js"]
    .map((name) => sitePath(name))
    .find((candidate) => fs.existsSync(candidate));
  if (file === undefined) return {};

  const loaded = require(file);
  const exported = loaded && loaded.__esModule ? loaded.default : loaded;
  const settings = typeof exported === "function" ? exported() : exported;
  if (!isPlainObject(settings)) {
    throw new Error(
      `${file} must export a configuration object — \`export default { title: "…" }\`. ` +
        "A function returning one works too, but it has to return synchronously.",
    );
  }

  const reserved = SHELL_OWNED.filter((key) => key in settings);
  if (reserved.length > 0) {
    console.warn(
      `[vsor] ignoring ${reserved.join(", ")} in ${file}: the runtime shell owns ` +
        "those keys, because they are the corpus pipeline rather than the site's identity.",
    );
    for (const key of reserved) delete settings[key];
  }
  return settings;
}

/**
 * Post-merge backfill: the two identity strings the shell must state literally
 * but that should FOLLOW the project's `title`.
 *
 * `themeConfig.navbar.title` and the footer copyright are baked into the object
 * above, before the merge, so they cannot read the merged title — and Infima's
 * Logo renders nothing at all when navbar.title is unset, so leaving it out is
 * not an option. Result before this: a project that set only `title` got its
 * own name in <title> and the shell's name in the bar.
 *
 * The backfill is deliberately narrow. It fires ONLY where the shell's own
 * untouched default is still in place, so a project that sets either value
 * explicitly — including to the empty string — keeps exactly what it wrote.
 */
function followTitle(merged: Settings): Settings {
  const title = typeof merged.title === "string" ? merged.title : SITE_TITLE;
  if (title === SITE_TITLE) return merged;

  const themeConfig = merged.themeConfig;
  if (!isPlainObject(themeConfig)) return merged;

  const navbar = themeConfig.navbar;
  const footer = themeConfig.footer;
  const nextTheme: Settings = { ...themeConfig };

  if (isPlainObject(navbar) && navbar.title === SITE_TITLE) {
    nextTheme.navbar = { ...navbar, title };
  }
  if (isPlainObject(footer) && footer.copyright === shellCopyright(SITE_TITLE)) {
    nextTheme.footer = { ...footer, copyright: shellCopyright(title) };
  }
  return { ...merged, themeConfig: nextTheme };
}

/**
 * Post-merge backfill #2: the values the shell composes from `baseUrl`.
 *
 * `baseUrl` is the project's to set (it is not a SHELL_OWNED key, and a GitHub
 * Pages project site cannot work without setting it), but two values above are
 * built from this shell's own BASE_URL constant, in an object literal evaluated
 * before the project's config is even loaded. They therefore have to be rebased
 * once the merge has produced the real value.
 *
 * Found live 2026-08-14 by the hosting acceptance, in the subpath shape only:
 *   - the declared favicon shipped `<link rel=icon href="/img/favicon.svg">` on
 *     a site served at `/repo/` — a 404 on every page, for every visitor, that
 *     no headless browser requests and so no browser tier could see (D8). The
 *     theme's own react-helmet icon link, which reads the merged config, was
 *     correct: the two disagreed inside one `<head>`.
 *   - the sitemap's `/search` ignore pattern stopped matching `/repo/search`, so
 *     a subpath deploy advertised its search page to crawlers and a root deploy
 *     did not — a route set that depends on where the site is deployed.
 *
 * Narrow on purpose, like followTitle: the icon tag is rewritten only where the
 * shell's own `rel="icon"` head tag is still in place, and only the ignore
 * patterns that actually begin with the shell's BASE_URL are rebased (so
 * `**\/tags/**`, which is relative and correct in both shapes, is left alone).
 */
function followBaseUrl(merged: Settings): Settings {
  const base =
    typeof merged.baseUrl === "string" && merged.baseUrl !== "" ? merged.baseUrl : BASE_URL;
  if (base === BASE_URL) return merged;

  const favicon = typeof merged.favicon === "string" ? merged.favicon : FAVICON;
  const next: Settings = { ...merged };

  if (Array.isArray(next.headTags)) {
    next.headTags = next.headTags.map((tag) => {
      if (!isPlainObject(tag) || tag.tagName !== "link") return tag;
      const attributes = tag.attributes;
      if (!isPlainObject(attributes) || attributes.rel !== "icon") return tag;
      if (attributes.href !== `${BASE_URL}${FAVICON}`) return tag;
      return { ...tag, attributes: { ...attributes, href: `${base}${favicon}` } };
    });
  }

  const rebase = (pattern: unknown) =>
    typeof pattern === "string" && pattern.startsWith(BASE_URL)
      ? `${base}${pattern.slice(BASE_URL.length)}`
      : pattern;

  if (Array.isArray(next.presets)) {
    next.presets = next.presets.map((entry) => {
      if (!Array.isArray(entry) || !isPlainObject(entry[1])) return entry;
      const options = entry[1] as Settings;
      const sitemap = options.sitemap;
      if (!isPlainObject(sitemap) || !Array.isArray(sitemap.ignorePatterns)) return entry;
      return [
        entry[0],
        { ...options, sitemap: { ...sitemap, ignorePatterns: sitemap.ignorePatterns.map(rebase) } },
      ];
    });
  }

  return next;
}

export default followBaseUrl(
  followTitle(mergeOver(config as unknown as Settings, projectSettings())),
) as Config;
