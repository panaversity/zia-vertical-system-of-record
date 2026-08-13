/**
 * @vsor/sor-site-theme — Docusaurus theme entry.
 *
 * Native seam only: the standard theme API (getThemePath), so every component
 * lands at @theme/<Name> and `docusaurus swizzle` --wrap/--eject work exactly
 * as agents already know from training data. No invented indirection.
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
 *   @theme/ModeToggle       — pure Docusaurus color-mode toggle (present but
 *                             unwired; for custom navbars)
 *
 * The token file (src/css/tokens.css) is loaded as a client module. It is the
 * designated token file of the surface spec's token discipline: every color
 * literal of this package lives there and nowhere else.
 */
const path = require("path");

module.exports = function sorSiteTheme() {
  return {
    name: "@vsor/sor-site-theme",
    getThemePath() {
      return path.resolve(__dirname, "./theme");
    },
    getClientModules() {
      return [require.resolve("./css/tokens.css")];
    },
  };
};
