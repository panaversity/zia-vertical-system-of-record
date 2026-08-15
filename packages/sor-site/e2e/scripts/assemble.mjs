#!/usr/bin/env node
/**
 * Assemble one fixture site for the browser tier (specs/sor-site/surface/spec.md, Phase B).
 *
 *   node assemble.mjs [--sentinel] --out <dir>
 *
 * Produces the MATERIALIZED SHAPE, not a site of its own — the layout
 * `vsor build` creates under `.vsor/site-runtime/`:
 *
 *   <out>/site-runtime/            the forked app (packages/sor-site/app), which
 *                                  IS the siteDir: its docusaurus.config.ts, its
 *                                  src/, its static/, its sidebars.ts
 *   <out>/site-runtime/site/       the project's authored site — a copy of the
 *                                  vsor init scaffold, placeholders stamped
 *                                  (__VSOR_NAME__ -> "fixture", __VSOR_YEAR__ ->
 *                                  "2026"). The shell reads it via VSOR_SITE_DIR.
 *   <out>/site-runtime/knowledge/  tests/fixtures/tiny, read via VSOR_KNOWLEDGE_DIR.
 *   <out>/manifest.json            what was stamped/patched — the tests' single
 *                                  source for sentinel and old values.
 *
 * ── Why this changed shape (2026-08-14, the fork) ────────────────────────────
 * Until the fork, `site/` WAS the siteDir: the scaffold shipped a complete
 * standalone docusaurus.config.ts that declared its own presets and themes, and
 * this script built it directly. It no longer does. The runtime shell is the
 * forked app, the scaffold's config is a `Partial<Config>` merged OVER it, and
 * `presets`/`plugins`/`themes`/`markdown`/`future`/`staticDirectories` are keys
 * the shell owns and drops from a project's file. So the only site this harness
 * can assemble is the one a project actually gets, and it assembles it the way
 * site_runtime.py does: unpack the shell, put the authored trees inside it,
 * point the shell's own env seams at them.
 *
 * The shell is copied from the working tree rather than from the packed tarball
 * on purpose, and the division is deliberate: `tests/acceptance/build.sh` drives
 * the real `vsor build` and therefore certifies the SHIPPED tarball end to end;
 * this tier certifies the SOURCE, so a red run here names a file you can open.
 * `make surface` runs both, build-acceptance first.
 *
 * ── Variants ─────────────────────────────────────────────────────────────────
 * One configuration, built twice (normal and --sentinel). The old stock/themed
 * axis is gone because the configuration it named cannot exist any more: "stock
 * preset-classic" meant deleting the separate design-system theme package from
 * the scaffold's own `themes` array, and a project can no longer write `themes`
 * at all — the design system is inside the shell, imported by the shell's own
 * custom.css, and its chrome is the shell's src/theme. (That theme package was
 * deleted outright on 2026-08-14.) There is no seam by which a vsor project
 * produces a site without it, so building one would certify a configuration no
 * user can have. B14 is retired in the spec; B15's control probe replaced it.
 *
 * --sentinel (Acceptance B12): after normal stamping, replace exactly three seams
 * of the PROJECT's authored site — themeConfig.navbar.title, footer copyright,
 * and --ifm-color-primary (light AND dark blocks, two distinct colors so each
 * theme's paint is provably token-driven). Every replacement verifies its exact
 * occurrence count; a scaffold change that breaks a pattern fails the assembly
 * loudly instead of silently testing nothing.
 *
 * No docusaurus build here — run.sh drives builds; this script only lays files down.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
const shellSource = path.join(repoRoot, "packages", "sor-site", "app");
const scaffoldSite = path.join(
  repoRoot, "packages", "vsor", "src", "vsor", "templates", "scaffold", "site",
);
const fixtures = path.join(repoRoot, "tests", "fixtures", "tiny");

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

// Never copied out of the shell: install and build state. Copying `build/` would
// make a stale run's output look like this run's.
const SHELL_SKIP = new Set(["node_modules", "build", ".docusaurus", ".gitignore"]);

function fail(msg) {
  console.error(`assemble: error: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { sentinel: false, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") args.out = argv[++i];
    else if (a === "--sentinel") args.sentinel = true;
    else fail(`unknown argument ${a} (usage: [--sentinel] --out <dir>)`);
  }
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

  for (const [label, p] of [
    ["the forked shell", shellSource],
    ["scaffold site", scaffoldSite],
    ["tests/fixtures/tiny", fixtures],
  ])
    if (!fs.existsSync(p)) fail(`${label} not found at ${p}`);

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  // 1 — the shell. Everything except install/build state; node module resolution
  // walks up from here into the committed packages/sor-site/node_modules, which
  // is where `npm ci` hoisted the shell's own dependencies and linked @vsor/lib-*.
  const shellDir = path.join(out, "site-runtime");
  fs.cpSync(shellSource, shellDir, {
    recursive: true,
    filter: (src) => !SHELL_SKIP.has(path.basename(src)),
  });
  for (const required of ["docusaurus.config.ts", path.join("src", "css", "tokens.css")])
    if (!fs.existsSync(path.join(shellDir, required)))
      fail(`the copied shell has no ${required} — packages/sor-site/app changed shape`);

  // 2 — the authored trees, INSIDE the shell (the layout copy_authored makes).
  const siteDir = path.join(shellDir, "site");
  fs.cpSync(scaffoldSite, siteDir, { recursive: true });
  // The whole fixture corpus, verbatim. gold.jsonl / ooc.txt are eval artifacts the
  // docs plugin ignores (not markdown); their semantics are untouched by this copy.
  fs.cpSync(fixtures, path.join(shellDir, "knowledge"), { recursive: true });

  // 3 — stamp placeholders across every text file of the authored site.
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

  // 4 — drift detection, in the shape the fork made it. The old counted replace
  // asserted the scaffold's `themes` block; the scaffold has no themes block now,
  // and the property that replaced it is the one worth guarding: the scaffold's
  // config is an OVERRIDE (Partial<Config>) and sets none of the six keys the
  // shell reserves. If it ever does, the shell drops them with a warning and this
  // harness would be certifying a config the site never saw.
  replaceCounted(config, "const config: Partial<Config> = {", "", 1,
    "docusaurus.config.ts (the scaffold is an override, not a standalone config)");
  const reserved = ["presets", "plugins", "themes", "markdown", "future", "staticDirectories"]
    .filter((key) => new RegExp(`^\\s{0,2}${key}:`, "m").test(config));
  if (reserved.length > 0)
    fail(`the scaffold config sets shell-owned key(s) ${reserved.join(", ")} — the shell drops them with a warning, so this build would not be the site under test`);

  // 5 — the homepage. It renders the shell's <Landing />, whose call to action is
  // derived from the corpus itself (the docs plugin's mainDocId), so there is
  // nothing here to retarget at the fixture. The counted check still guards the
  // seam: if the scaffold homepage stops importing @theme/Landing — which only
  // resolves because the shell ships src/theme/Landing — this assembly fails.
  const homePath = path.join(siteDir, "src", "pages", "index.tsx");
  replaceCounted(fs.readFileSync(homePath, "utf8"),
    'import Landing from "@theme/Landing";', "", 1, "src/pages/index.tsx");

  const cssPath = path.join(siteDir, "src", "css", "custom.css");
  let css = fs.readFileSync(cssPath, "utf8");
  const primaryRe = /--ifm-color-primary:\s*([^;]+);/g;
  const primaries = [...css.matchAll(primaryRe)].map((m) => m[1].trim());
  if (primaries.length !== 2)
    fail(`expected exactly 2 --ifm-color-primary declarations in custom.css (light, dark), found ${primaries.length}`);
  const [oldPrimaryLight, oldPrimaryDark] = primaries;

  const manifest = {
    generatedBy: "packages/sor-site/e2e/scripts/assemble.mjs",
    variant: "site",
    sentinel: args.sentinel,
    instanceName: INSTANCE_NAME,
    year: YEAR,
    siteUrl: (config.match(/\burl:\s*"([^"]+)"/) ?? fail("no url: \"...\" in docusaurus.config.ts"))[1],
    // A doc route the suite can visit: it has a sidebar (B12 paints
    // .menu__link--active on it) and it is the one fixture doc carrying the
    // quiz and the unique search phrase. NOT "where the homepage links" — the
    // homepage derives its call to action from the corpus's mainDocId, so B11
    // reads that href off the page instead of assuming it.
    docRoute: "/docs/one-source-two-surfaces",
    oldValues: {
      navTitle: INSTANCE_NAME,
      footerCopyright: `© ${YEAR} ${INSTANCE_NAME}`,
      primaryLight: oldPrimaryLight,
      primaryDark: oldPrimaryDark,
    },
    sentinels: SENTINELS,
  };

  // 6 — sentinel build (B12): exactly three seams change, nothing else. All three
  // live in the PROJECT's authored site, which is the point — they prove the
  // merge and the cascade, not the shell's own defaults.
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
    fs.writeFileSync(configPath, config);
  }

  fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`assemble: ${args.sentinel ? "sentinel" : "normal"} -> ${out}`);
}

main();
