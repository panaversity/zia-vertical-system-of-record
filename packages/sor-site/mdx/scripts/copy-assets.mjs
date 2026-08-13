// Post-tsc build step:
//  1. copies CSS modules from src/ into lib/, preserving relative paths, so
//     the compiled theme components resolve their styles
//     (readdirSync recursive rather than fs.globSync — globSync needs
//     node >= 22, this workspace promises node >= 20);
//  2. prunes .d.ts files from lib/theme/ — found live (2026-08-13): the
//     Docusaurus theme scanner globs *.{js,ts,...} and a sibling
//     MDXComponents.d.ts registers an "@theme/MDXComponents.d" alias whose
//     key breaks the alias sort (partial comparator), letting
//     "@theme/MDXComponents" shadow "@theme/MDXComponents/Code" and fail the
//     whole client build with "Can't resolve '@theme/MDXComponents/Code'".
//     Swizzle typings come from src/theme via getTypeScriptThemePath.
import { cpSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(pkgRoot, "src");
const outDir = join(pkgRoot, "lib");

for (const rel of readdirSync(srcDir, { recursive: true })) {
  if (String(rel).endsWith(".css")) {
    cpSync(join(srcDir, String(rel)), join(outDir, String(rel)));
  }
}

const themeDir = join(outDir, "theme");
for (const rel of readdirSync(themeDir, { recursive: true })) {
  if (String(rel).endsWith(".d.ts")) {
    rmSync(join(themeDir, String(rel)));
  }
}
