#!/usr/bin/env node
/**
 * Assemble one fixture site for the browser tier (specs/sor-site/surface/spec.md, Phase B).
 *
 *   node assemble.mjs --variant stock|themed [--sentinel] --out <dir>
 *
 * Produces:
 *   <out>/site/          copy of packages/vsor/src/vsor/templates/scaffold/site,
 *                        placeholders stamped (__VSOR_NAME__ -> "fixture",
 *                        __VSOR_YEAR__ -> "2026"), themes wired per variant
 *   <out>/knowledge/     copy of fixtures/tiny (the docs plugin reads ../knowledge)
 *   <out>/manifest.json  what was stamped/patched — the tests' single source for
 *                        sentinel values and old values (nothing hardcoded twice)
 *
 * Variants (settled lead decisions, 2026-08-13):
 *   stock  = stock @docusaurus/preset-classic + the mdx vocabulary package
 *   themed = stock + @vsor/sor-site-theme layered on top
 *   Both wire @easyops-cn/docusaurus-search-local (hashed: false): it is the site
 *   shell's search (allowlisted, local index), B13 requires a SearchBar in both
 *   configs, and the themed SearchBar shadows it while reading its index file.
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

  // 2 — wire themes for the variant, inserted before the presets block.
  if (config.includes("themes:"))
    fail("scaffold config already declares themes: — assemble.mjs would double-wire; reconcile first");
  const searchLocal =
    `    [\n      "@easyops-cn/docusaurus-search-local",\n      // hashed: false — the themed SearchBar reads /search-index.json at a stable path.\n      { hashed: false, indexBlog: false },\n    ],\n`;
  const themeLines =
    args.variant === "stock"
      ? `  themes: [\n    "@vsor/sor-site-mdx",\n${searchLocal}  ],\n\n`
      : `  themes: [\n    "@vsor/sor-site-mdx",\n${searchLocal}    // listed after search-local so its SearchBar shadows the stock one\n    "@vsor/sor-site-theme",\n  ],\n\n`;
  config = replaceCounted(
    config,
    "  presets: [",
    `${themeLines}  presets: [`,
    1,
    "docusaurus.config.ts",
  );

  // 3 — the scaffold homepage links to /docs/example (it ships with
  // knowledge/example.md). This harness substitutes fixtures/tiny as the corpus,
  // so retarget that one link to a fixture doc; Docusaurus's own broken-link
  // check (onBrokenLinks: throw) stays armed for everything else.
  const homePath = path.join(siteDir, "src", "pages", "index.tsx");
  fs.writeFileSync(
    homePath,
    replaceCounted(fs.readFileSync(homePath, "utf8"), "/docs/example", "/docs/karahi", 1, "src/pages/index.tsx"),
  );

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
    homeDocRoute: "/docs/karahi",
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
    config = replaceCounted(
      config,
      `navbar: { title: "${INSTANCE_NAME}" }`,
      `navbar: { title: "${SENTINELS.navTitle}" }`,
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
