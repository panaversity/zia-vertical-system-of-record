/**
 * Remark Plugin: Gallery
 *
 * Injects gallery YAML data as props into <ConversationGallery /> JSX elements
 * during the MDX build. Co-located .gallery.yaml files are loaded
 * and passed as the `gallery` prop.
 *
 * Copied from ag2 libs/docusaurus/remark-gallery at d764f334; the loader
 * moved to @vsor/lib-shared, nothing else changed.
 *
 * Usage in docusaurus.config.ts:
 *
 * remarkPlugins: [
 *   require('@vsor/lib-remark-gallery')
 * ]
 */

const { visit } = require("unist-util-visit");
const { loadGalleryForFile } = require("@vsor/lib-shared/galleryLoader");

function valueToEstree(value) {
  if (value === null || value === undefined) {
    return { type: "Literal", value: null, raw: "null" };
  }
  if (typeof value === "string") {
    return { type: "Literal", value, raw: JSON.stringify(value) };
  }
  if (typeof value === "number") {
    return { type: "Literal", value, raw: String(value) };
  }
  if (typeof value === "boolean") {
    return { type: "Literal", value, raw: String(value) };
  }
  if (Array.isArray(value)) {
    return { type: "ArrayExpression", elements: value.map(valueToEstree) };
  }
  if (typeof value === "object") {
    return {
      type: "ObjectExpression",
      properties: Object.entries(value).map(([key, val]) => ({
        type: "Property",
        method: false,
        shorthand: false,
        computed: false,
        key: { type: "Identifier", name: key },
        value: valueToEstree(val),
        kind: "init",
      })),
    };
  }
  return { type: "Literal", value: null, raw: "null" };
}

function makeGalleryAttribute(galleryData) {
  return {
    type: "mdxJsxAttribute",
    name: "gallery",
    value: {
      type: "mdxJsxAttributeValueExpression",
      value: JSON.stringify(galleryData),
      data: {
        estree: {
          type: "Program",
          body: [
            {
              type: "ExpressionStatement",
              expression: valueToEstree(galleryData),
            },
          ],
          sourceType: "module",
        },
      },
    },
  };
}

function remarkGallery(options = {}) {
  const loader = options._loader || loadGalleryForFile;

  return (tree, file) => {
    const filePath = (file.history?.[0] ?? file.path ?? "").replace(/\\/g, "/");

    visit(tree, "mdxJsxFlowElement", (node) => {
      if (node.name !== "ConversationGallery") {
        return;
      }

      // Skip if gallery prop is already explicitly set
      const hasGallery = (node.attributes || []).some(
        (attr) => attr.type === "mdxJsxAttribute" && attr.name === "gallery",
      );
      if (hasGallery) {
        return;
      }

      let result;
      try {
        result = loader(filePath);
      } catch (err) {
        throw new Error(
          `remark-gallery: failed to load gallery for "${filePath}": ${err.message}`,
        );
      }

      if (result === null) {
        node.attributes = node.attributes || [];
        node.attributes.push(makeGalleryAttribute(null));
        return;
      }

      const { gallery } = result;

      if (!gallery || !gallery.gallery?.exercise_id) {
        throw new Error(
          `remark-gallery: gallery for "${filePath}" is missing required "gallery.exercise_id" field`,
        );
      }

      if (!Array.isArray(gallery.gallery?.conversations)) {
        throw new Error(
          `remark-gallery: gallery for "${filePath}" is missing required "gallery.conversations" array`,
        );
      }

      node.attributes = node.attributes || [];
      node.attributes.push(makeGalleryAttribute(gallery));
    });
  };
}

module.exports = remarkGallery;
