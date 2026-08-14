/**
 * Remark Content Enhancements Plugin
 *
 * Composable content enhancement orchestrator that applies transformers
 * based on frontmatter metadata.
 *
 * Copied from ag2 libs/docusaurus/remark-content-enhancements at d764f334.
 * Changes on the way across the seam:
 * - interactive-code branch removed (practice/simulation is excluded by the
 *   surface spec's negative contract; remark-interactive-python stays behind).
 * - non-English heading matchers removed from the slides transformer
 *   (i18n is deferred wholesale post-v0).
 * - the injected component name is configurable (`slidesConfig.component`,
 *   default "SlidesViewer") — upstream hardcoded its pdf-viewer component,
 *   which does not cross the seam.
 *
 * This plugin implements a 3-layer separation architecture:
 * - Layer 1: Content (frontmatter metadata - platform-agnostic)
 * - Layer 2: Build-time transformation (this plugin - portable)
 * - Layer 3: Runtime components (React - platform-specific)
 *
 * Usage in docusaurus.config.ts:
 * ```js
 * remarkPlugins: [
 *   [require('@vsor/lib-remark-content-enhancements'), {
 *     enableSlides: true,
 *     slidesConfig: { defaultHeight: 700, component: 'SlidesViewer' }
 *   }]
 * ]
 * ```
 *
 * Supported frontmatter:
 * ```yaml
 * ---
 * slides: "slides/part-14.pdf"
 * # OR
 * slides:
 *   source: "slides/part-14.pdf"
 *   placement: "before-what-you-learn"
 *   height: 700
 *   title: "Slides"
 * ---
 * ```
 */

const slidesTransformer = require("./transformers/slides");

function remarkContentEnhancements(options = {}) {
  const { enableSlides = true, slidesConfig = {} } = options;

  return (tree, file) => {
    // Parse frontmatter (available via file.data.frontMatter in Docusaurus - note capital M)
    // See: https://github.com/facebook/docusaurus/discussions/8759
    const frontmatter = file.data?.frontMatter || {};

    // Get slides from frontmatter
    const slides = frontmatter.slides;

    // Slides transformation (synchronous)
    if (enableSlides && slides) {
      try {
        slidesTransformer.transform(tree, file, slides, slidesConfig);
      } catch (error) {
        console.error(
          "[Content Enhancements] Error during slides transformation:",
          error,
        );
      }
    }
  };
}

module.exports = remarkContentEnhancements;
