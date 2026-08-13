/**
 * @vsor/sor-site-mdx — Docusaurus theme entry.
 *
 * Wired as `themes: ["@vsor/sor-site-mdx"]` in a site's docusaurus.config, it
 * layers `lib/theme/` over the active theme: MDXComponents gains the corpus
 * vocabulary (Quiz, Flashcards, ConversationGallery, ExerciseCard,
 * HighlightTip, Tabs/TabItem) and Root mounts the headless ImageZoom. Works
 * on stock `@docusaurus/preset-classic` with no other theme installed — the
 * `@vsor/sor-site-theme` package only restyles this vocabulary, never changes
 * its contract (specs/sor-site/surface/spec.md).
 *
 * found live (2026-08-13, stock preset-classic build): this entry is CJS and
 * hand-written because Node loads it at config time, while everything under
 * lib/ is compiled ESM because the Docusaurus webpack/babel pipeline parses
 * theme client code as ESM (babel default sourceType "module" injects ESM
 * helper imports) — CJS client output crashed in the browser bundle with
 * "exports is not defined". Same split @docusaurus/theme-classic ships.
 */
"use strict";

const path = require("path");

function sorSiteMdx() {
  return {
    name: "@vsor/sor-site-mdx",
    // Compiled ESM theme components — bundled by webpack, never require()d
    // by Node.
    getThemePath: () => path.join(__dirname, "lib", "theme"),
    // TypeScript sources, for `docusaurus swizzle --typescript`.
    getTypeScriptThemePath: () => path.join(__dirname, "src", "theme"),
  };
}

// Callable directly (CJS require) and via .default (ESM default-import
// interop) — Docusaurus accepts either shape.
module.exports = sorSiteMdx;
module.exports.default = sorSiteMdx;
