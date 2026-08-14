#!/usr/bin/env node
/**
 * Assemble one fixture site for the browser tier (specs/sor-site/surface/spec.md, Phase B).
 *
 *   node assemble.mjs --variant stock|themed [--sentinel] --out <dir>
 *
 * Produces:
 *   <out>/site/          copy of packages/vsor/src/vsor/templates/scaffold/site,
 *                        placeholders stamped (__VSOR_NAME__ -> "fixture",
 *                        __VSOR_YEAR__ -> "2026"); themed variant appends
 *                        @vsor/sor-site-theme to the scaffold's own themes line
 *   <out>/knowledge/     copy of fixtures/tiny (the docs plugin reads ../knowledge)
 *   <out>/manifest.json  what was stamped/patched — the tests' single source for
 *                        sentinel values and old values (nothing hardcoded twice)
 *
 * Variants (settled lead decisions, 2026-08-13; amended 2026-08-14 when the full
 * theme became the scaffold default — specs/sor-site/surface, "the scaffold ships
 * the full theme on by default"):
 *   themed = the scaffold VERBATIM — config and homepage both. It is now the
 *            default configuration, so this harness injects nothing and certifies
 *            the exact site `vsor build` emits (one enforcement, literally).
 *            search-local's defaults are the wired options: hashed defaults to
 *            false (the themed SearchBar reads /search-index.json at a stable
 *            path) and indexBlog defaults to true but is inert — the scaffold
 *            sets blog: false, so no blog route ever reaches the indexer.
 *   stock  = the documented fallback: @vsor/sor-site-theme removed from themes,
 *            and the homepage replaced, because the scaffold's homepage renders
 *            the theme's <Landing /> and @theme/Landing does not exist without
 *            the theme. The replacement is exactly what the scaffold config's
 *            comment tells an owner to write when they delete that line — so
 *            that advice is tested rather than asserted.
 *   The counted replaces are the drift detector: if the scaffold and this
 *   harness disagree on the themes block or the homepage, the assembly fails
 *   loudly instead of silently testing a different config.
 *
 * --sentinel (Acceptance B12): after normal stamping, replace exactly three seams —
 *   themeConfig.navbar.title, footer copyright, and --ifm-color-primary (light AND
 *   dark blocks, two distinct colors so each theme's paint is provably token-driven).
 *   Every replacement verifies its exact occurrence count; a scaffold change that
 *   breaks a pattern fails the assembly loudly instead of silently testing nothing.
 *
 * No docusaurus build here — run.sh drives builds; this script only lays files down.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
const scaffoldSite = path.join(
  repoRoot, "packages", "vsor", "src", "vsor", "templates", "scaffold", "site",
);
const fixtures = path.join(repoRoot, "fixtures", "tiny");

const INSTANCE_NAME = "fixture";
const YEAR = "2026";
// B12 sentinels. Distinct light/dark primaries prove the painted color derives
// from the token under each data-theme, not from a baked-in literal. Neither hex
// has a shorter/named cssnano form, so the literal survives minification intact.
const SENTINELS = {
  navTitle: "SENTINEL-NAV-73qx",
  footerCopyright: "SENTINEL-FOOT-51zv",
  primaryLight: { hex: "#b3261e", rgb: "rgb(179, 38, 30)" },
  primaryDark: { hex: "#1eb3a6", rgb: "rgb(30, 179, 166)" },
};

const TEXT_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".css", ".md", ".mdx", ".json", ".html"]);

function fail(msg) {
  console.error(`assemble: error: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { sentinel: false, variant: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--variant") args.variant = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--sentinel") args.sentinel = true;
    else fail(`unknown argument ${a} (usage: --variant stock|themed [--sentinel] --out <dir>)`);
  }
  if (args.variant !== "stock" && args.variant !== "themed")
    fail(`--variant must be stock or themed, got ${args.variant}`);
  if (!args.out) fail("--out is required");
  return args;
}

/** Replace `from` with `to` in `text`, asserting it occurs exactly `count` times. */
function replaceCounted(text, from, to, count, where) {
  const parts = text.split(from);
  if (parts.length - 1 !== count)
    fail(`expected exactly ${count} occurrence(s) of ${JSON.stringify(from)} in ${where}, found ${parts.length - 1} — the scaffold changed; update assemble.mjs`);
  return parts.join(to);
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = path.resolve(args.out);

  for (const [label, p] of [["scaffold site", scaffoldSite], ["fixtures/tiny", fixtures]])
    if (!fs.existsSync(p)) fail(`${label} not found at ${p}`);

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const siteDir = path.join(out, "site");
  fs.cpSync(scaffoldSite, siteDir, { recursive: true });
  // The whole fixture corpus, verbatim. gold.jsonl / ooc.txt are eval artifacts the
  // docs plugin ignores (not markdown); their semantics are untouched by this copy.
  fs.cpSync(fixtures, path.join(out, "knowledge"), { recursive: true });

  // 1 — stamp placeholders across every text file of the site shell.
  let nameStamps = 0;
  for (const file of walk(siteDir)) {
    if (!TEXT_EXT.has(path.extname(file))) continue;
    const before = fs.readFileSync(file, "utf8");
    const after = before
      .replaceAll("__VSOR_NAME__", INSTANCE_NAME)
      .replaceAll("__VSOR_YEAR__", YEAR);
    if (after !== before) {
      nameStamps += before.split("__VSOR_NAME__").length - 1;
      fs.writeFileSync(file, after);
    }
  }
  if (nameStamps < 1) fail("no __VSOR_NAME__ placeholder found in the scaffold site — nothing stamped");

  const configPath = path.join(siteDir, "docusaurus.config.ts");
  let config = fs.readFileSync(configPath, "utf8");

  // 2 — the scaffold declares all three themes itself (specs/vsor/build: the
  // visible, deletable seam). The counted replace doubles as drift detection:
  // themed re-asserts the exact block (replaced with itself), stock collapses it
  // to the two preset-classic-compatible entries. A scaffold change that touches
  // the block fails the assembly loudly instead of silently testing nothing.
  const scaffoldThemesBlock =
    `  themes: [\n    "@vsor/sor-site-mdx",\n    "@easyops-cn/docusaurus-search-local",\n    // last, so its search box shadows the search plugin's own\n    "@vsor/sor-site-theme",\n  ],`;
  const stockThemesLine =
    '  themes: ["@vsor/sor-site-mdx", "@easyops-cn/docusaurus-search-local"],';
  config = replaceCounted(
    config,
    scaffoldThemesBlock,
    args.variant === "stock" ? stockThemesLine : scaffoldThemesBlock,
    1,
    "docusaurus.config.ts (the scaffold's themes seam)",
  );

  // 3 — the homepage. Themed keeps the scaffold's verbatim: it renders the
  // theme's <Landing />, whose call to action is derived from the corpus itself
  // (the docs plugin's mainDocId), so there is nothing here to retarget at the
  // fixture. Stock cannot render it — @theme/Landing exists only while the theme
  // is in `themes` — so it gets the preset-classic page the scaffold config's
  // comment tells an owner to write when they remove that line. The counted
  // replace still guards the seam: if the scaffold homepage stops importing
  // @theme/Landing, this assembly fails loudly.
  const homePath = path.join(siteDir, "src", "pages", "index.tsx");
  const home = fs.readFileSync(homePath, "utf8");
  replaceCounted(home, 'import Landing from "@theme/Landing";', "", 1, "src/pages/index.tsx");
  if (args.variant === "stock") {
    fs.writeFileSync(
      homePath,
      [
        "// Generated by e2e/scripts/assemble.mjs for the STOCK variant: the scaffold",
        "// homepage renders @theme/Landing, which needs @vsor/sor-site-theme. This is",
        "// the preset-classic page the scaffold config's comment prescribes instead.",
        'import Link from "@docusaurus/Link";',
        'import Layout from "@theme/Layout";',
        'import type { ReactNode } from "react";',
        "",
        "export default function Home(): ReactNode {",
        "  return (",
        "    <Layout>",
        '      <main style={{ textAlign: "center", padding: "6rem 1rem" }}>',
        `        <h1>${INSTANCE_NAME}</h1>`,
        '        <Link className="button button--primary button--lg" to="/docs/karahi">',
        "          Read the knowledge base",
        "        </Link>",
        "      </main>",
        "    </Layout>",
        "  );",
        "}",
        "",
      ].join("\n"),
    );
  }

  const cssPath = path.join(siteDir, "src", "css", "custom.css");
  let css = fs.readFileSync(cssPath, "utf8");
  const primaryRe = /--ifm-color-primary:\s*([^;]+);/g;
  const primaries = [...css.matchAll(primaryRe)].map((m) => m[1].trim());
  if (primaries.length !== 2)
    fail(`expected exactly 2 --ifm-color-primary declarations in custom.css (light, dark), found ${primaries.length}`);
  const [oldPrimaryLight, oldPrimaryDark] = primaries;

  const manifest = {
    generatedBy: "packages/sor-site/e2e/scripts/assemble.mjs",
    variant: args.variant,
    sentinel: args.sentinel,
    instanceName: INSTANCE_NAME,
    year: YEAR,
    siteUrl: (config.match(/\burl:\s*"([^"]+)"/) ?? fail("no url: \"...\" in docusaurus.config.ts"))[1],
    // A doc route both variants can visit: it has a sidebar (B12 paints
    // .menu__link--active on it) and it is the one fixture doc carrying the
    // quiz and the unique search phrase. NOT "where the homepage links" — the
    // themed homepage derives its call to action from the corpus's mainDocId,
    // so B11 reads that href off the page instead of assuming it.
    docRoute: "/docs/karahi",
    oldValues: {
      navTitle: INSTANCE_NAME,
      footerCopyright: `© ${YEAR} ${INSTANCE_NAME}`,
      primaryLight: oldPrimaryLight,
      primaryDark: oldPrimaryDark,
    },
    sentinels: SENTINELS,
  };

  // 4 — sentinel build (B12): exactly three seams change, nothing else.
  if (args.sentinel) {
    // Scoped to the navbar block on purpose: `title:` also appears at the top
    // level of the config (siteConfig.title, which B9 asserts on), and the two
    // seams must move independently.
    config = replaceCounted(
      config,
      `navbar: {\n      title: "${INSTANCE_NAME}",`,
      `navbar: {\n      title: "${SENTINELS.navTitle}",`,
      1,
      "docusaurus.config.ts (navbar.title)",
    );
    config = replaceCounted(
      config,
      `© ${YEAR} ${INSTANCE_NAME}`,
      SENTINELS.footerCopyright,
      1,
      "docusaurus.config.ts (footer.copyright)",
    );
    let i = 0;
    css = css.replace(primaryRe, () =>
      `--ifm-color-primary: ${i++ === 0 ? SENTINELS.primaryLight.hex : SENTINELS.primaryDark.hex};`,
    );
    fs.writeFileSync(cssPath, css);
  }
  fs.writeFileSync(configPath, config);

  // 5 — a package.json marks the scratch site dir; dependency resolution walks up
  // into the committed sor-site workspace (the scratch dir lives under e2e/).
  fs.writeFileSync(
    path.join(siteDir, "package.json"),
    JSON.stringify(
      { name: `vsor-e2e-${args.variant}${args.sentinel ? "-sentinel" : ""}`, private: true, description: "generated by e2e/scripts/assemble.mjs — never committed" },
      null,
      2,
    ) + "\n",
  );

  fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`assemble: ${args.variant}${args.sentinel ? " (sentinel)" : ""} -> ${out}`);
}

main();
