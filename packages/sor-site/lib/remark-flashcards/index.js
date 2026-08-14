/**
 * Remark Plugin: Flashcards
 *
 * Injects flashcard YAML data as props into <Flashcards /> JSX elements
 * during the MDX build. Co-located .flashcards.yaml files are loaded
 * and passed as the `cards` prop.
 *
 * Copied from ag2 libs/docusaurus/remark-flashcards at d764f334; the loader
 * moved to @vsor/lib-shared, nothing else changed.
 *
 * Usage in docusaurus.config.ts:
 *
 * remarkPlugins: [
 *   require('@vsor/lib-remark-flashcards')
 * ]
 */

const { visit } = require("unist-util-visit");
const { loadDeckForFile } = require("@vsor/lib-shared/flashcardLoader");

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

function makeCardsAttribute(deckData) {
  return {
    type: "mdxJsxAttribute",
    name: "cards",
    value: {
      type: "mdxJsxAttributeValueExpression",
      value: JSON.stringify(deckData),
      data: {
        estree: {
          type: "Program",
          body: [
            {
              type: "ExpressionStatement",
              expression: valueToEstree(deckData),
            },
          ],
          sourceType: "module",
        },
      },
    },
  };
}

function remarkFlashcards(options = {}) {
  const loader = options._loader || loadDeckForFile;

  return (tree, file) => {
    const filePath = (file.history?.[0] ?? file.path ?? "").replace(/\\/g, "/");

    visit(tree, "mdxJsxFlowElement", (node) => {
      if (node.name !== "Flashcards") {
        return;
      }

      // Skip if cards prop is already explicitly set
      const hasCards = (node.attributes || []).some(
        (attr) => attr.type === "mdxJsxAttribute" && attr.name === "cards",
      );
      if (hasCards) {
        return;
      }

      let result;
      try {
        result = loader(filePath);
      } catch (err) {
        throw new Error(
          `remark-flashcards: failed to load flashcards for "${filePath}": ${err.message}`,
        );
      }

      if (result === null) {
        node.attributes = node.attributes || [];
        node.attributes.push(makeCardsAttribute(null));
        return;
      }

      const { deck } = result;

      // YAML structure: { deck: { id, title, ... }, cards: [...] }
      if (!deck || !deck.deck?.id) {
        throw new Error(
          `remark-flashcards: deck for "${filePath}" is missing required "deck.id" field`,
        );
      }

      if (!Array.isArray(deck.cards)) {
        throw new Error(
          `remark-flashcards: deck for "${filePath}" is missing required "cards" array`,
        );
      }

      node.attributes = node.attributes || [];
      node.attributes.push(makeCardsAttribute(deck));
    });
  };
}

module.exports = remarkFlashcards;
