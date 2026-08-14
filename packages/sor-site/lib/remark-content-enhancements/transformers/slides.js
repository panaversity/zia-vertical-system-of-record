/**
 * Slides Transformer
 *
 * Injects a slides-viewer component based on frontmatter metadata.
 * Supports both local paths and cloud URLs transparently.
 *
 * Copied from ag2 libs/docusaurus/remark-content-enhancements/transformers/slides.js
 * at d764f334; non-English heading matchers stripped (i18n deferred post-v0)
 * and the component name made configurable (upstream's pdf-viewer component
 * is excluded by the surface spec).
 *
 * Frontmatter schema:
 * ---
 * slides:
 *   source: "slides/filing-deadlines.pdf" | "https://cdn.example.com/slide.pdf"
 *   placement: "before-what-you-learn" | "after-intro"
 *   height: 700
 *   title: "Filing deadlines — deck"
 * ---
 *
 * OR simple string format:
 * ---
 * slides: "slides/filing-deadlines.pdf"
 * ---
 */

const { visit } = require("unist-util-visit");

const verbose = process.env.VERBOSE_DOCUSAURUS_PLUGINS === "true";

const DEFAULT_COMPONENT = "SlidesViewer";

/**
 * Check if a string is a URL
 */
function isUrl(str) {
  return str.startsWith("http://") || str.startsWith("https://");
}

/**
 * Normalize path to absolute from static directory
 * URLs are returned as-is
 */
function normalizePath(source) {
  if (isUrl(source)) {
    return source; // Use URL as-is
  }
  // Normalize local path to absolute from static directory
  return source.startsWith("/") ? source : `/${source}`;
}

function getHeadingText(node) {
  if (!Array.isArray(node.children)) {
    return "";
  }

  return node.children
    .map((child) => {
      if (typeof child.value === "string") {
        return child.value;
      }

      if (Array.isArray(child.children)) {
        return getHeadingText(child);
      }

      return "";
    })
    .join("")
    .trim()
    .toLowerCase();
}

function findHeadingIndex(tree, matcher, offset = 0) {
  let targetIndex = -1;

  visit(tree, "heading", (node, index, parent) => {
    if (targetIndex !== -1) {
      return visit.EXIT;
    }

    if (!Array.isArray(parent?.children) || typeof index !== "number") {
      return;
    }

    if (matcher(node)) {
      targetIndex = index + offset;
      return visit.EXIT;
    }
  });

  return targetIndex;
}

function hasExistingViewer(tree, component) {
  let found = false;

  visit(tree, "mdxJsxFlowElement", (node) => {
    if (node.name === component) {
      found = true;
      return visit.EXIT;
    }
  });

  return found;
}

/**
 * Find injection point in AST based on placement strategy
 */
function findInjectionPoint(tree, placement) {
  if (placement === "before-what-you-learn") {
    const whatYouLearnIndex = findHeadingIndex(tree, (node) => {
      if (node.depth !== 2) {
        return false;
      }

      const text = getHeadingText(node);
      return (
        text.includes("what you'll learn") ||
        text.includes("what you will learn")
      );
    });

    if (whatYouLearnIndex !== -1) {
      return whatYouLearnIndex;
    }

    return findHeadingIndex(
      tree,
      (node) => {
        if (node.depth !== 2) {
          return false;
        }

        const text = getHeadingText(node);
        return (
          text.includes("teaching aid") || text.includes("teaching material")
        );
      },
      1,
    );
  }

  if (placement === "after-intro") {
    return findHeadingIndex(tree, (node) => node.depth === 2);
  }

  return -1;
}

/**
 * Create the slides-viewer JSX node for injection
 */
function createViewerNode(slides, component) {
  const { source, height = 700, title = "Slides" } = slides;
  const normalizedSource = normalizePath(source);

  return {
    type: "mdxJsxFlowElement",
    name: component,
    attributes: [
      {
        type: "mdxJsxAttribute",
        name: "src",
        value: normalizedSource,
      },
      {
        type: "mdxJsxAttribute",
        name: "title",
        value: title,
      },
      {
        type: "mdxJsxAttribute",
        name: "height",
        value: {
          type: "mdxJsxAttributeValueExpression",
          value: String(height),
          data: {
            estree: {
              type: "Program",
              body: [
                {
                  type: "ExpressionStatement",
                  expression: {
                    type: "Literal",
                    value: height,
                    raw: String(height),
                  },
                },
              ],
              sourceType: "module",
            },
          },
        },
      },
    ],
    children: [],
  };
}

/**
 * Transform tree by injecting the slides-viewer component
 */
function transform(tree, file, slidesMetadata, config = {}) {
  const component = config.component || DEFAULT_COMPONENT;

  // Normalize metadata to object format
  let slides;
  if (typeof slidesMetadata === "string") {
    slides = {
      source: slidesMetadata,
      placement: "before-what-you-learn",
      height: 700,
      title: "Slides",
    };
  } else {
    slides = {
      source: slidesMetadata.source,
      placement: slidesMetadata.placement || "before-what-you-learn",
      height: slidesMetadata.height || config.defaultHeight || 700,
      title: slidesMetadata.title || "Slides",
    };
  }

  if (hasExistingViewer(tree, component)) {
    if (verbose) {
      console.log(
        `[Slides Transformer] Skipped ${slides.source} because ${component} already exists in ${file.path || "unknown file"}`,
      );
    }
    return;
  }

  // Find where to inject
  const injectionIndex = findInjectionPoint(tree, slides.placement);

  if (injectionIndex === -1) {
    console.warn(
      `[Slides Transformer] Could not find injection point "${slides.placement}" in ${file.path || "unknown file"}`,
    );
    return;
  }

  // Create the viewer node
  const viewerNode = createViewerNode(slides, component);

  // Inject before target heading in tree.children
  if (tree.children) {
    tree.children.splice(injectionIndex, 0, viewerNode);
    if (verbose) {
      console.log(
        `[Slides Transformer] Injected ${slides.source} at ${slides.placement}`,
      );
    }
  }
}

module.exports = { transform };
