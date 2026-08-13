// Ported from ag2 libs/docusaurus/remark-content-enhancements/__tests__/slides.test.js
// at d764f334. The translated-headings case is dropped with the i18n strip;
// the component name follows the seam rework (SlidesViewer by default,
// configurable) and a case pins the config override.

const test = require("node:test");
const assert = require("node:assert/strict");

const { transform } = require("../transformers/slides");

function makeHeading(depth, text) {
  return {
    type: "heading",
    depth,
    children: [{ type: "text", value: text }],
  };
}

function makeParagraph(text) {
  return {
    type: "paragraph",
    children: [{ type: "text", value: text }],
  };
}

function makeTree(children) {
  return {
    type: "root",
    children,
  };
}

function makeFile(path) {
  return { path };
}

function findViewerIndex(tree, component = "SlidesViewer") {
  return tree.children.findIndex(
    (node) => node.type === "mdxJsxFlowElement" && node.name === component,
  );
}

test("injects slides before the What You'll Learn heading", () => {
  const tree = makeTree([
    makeHeading(1, "Chapter 1"),
    makeParagraph("Intro"),
    makeHeading(2, "Teaching Aid"),
    makeHeading(2, "What You'll Learn"),
  ]);

  transform(
    tree,
    makeFile("/docs/chapter-1/README.md"),
    { source: "slides/chapter-1.pdf" },
    {},
  );

  const viewerIndex = findViewerIndex(tree);
  assert.equal(viewerIndex, 3);
  assert.equal(
    tree.children[viewerIndex + 1].children[0].value,
    "What You'll Learn",
  );
});

test("falls back to the Teaching Aid section when What You'll Learn is absent", () => {
  const tree = makeTree([
    makeHeading(1, "Chapter 23"),
    makeParagraph("Intro"),
    makeHeading(2, "Teaching Aid"),
    makeHeading(3, "Lesson Map"),
  ]);

  transform(
    tree,
    makeFile("/docs/chapter-23/README.md"),
    { source: "slides/chapter-23.pdf" },
    {},
  );

  const viewerIndex = findViewerIndex(tree);
  assert.equal(viewerIndex, 3);
  assert.equal(tree.children[viewerIndex + 1].children[0].value, "Lesson Map");
});

test("skips auto-injection when a manual viewer already exists", () => {
  const tree = makeTree([
    makeHeading(1, "Chapter 31"),
    makeHeading(2, "Teaching Aid"),
    {
      type: "mdxJsxFlowElement",
      name: "SlidesViewer",
      attributes: [],
      children: [],
    },
    makeHeading(2, "Prerequisites"),
  ]);

  transform(
    tree,
    makeFile("/docs/chapter-31/README.md"),
    { source: "slides/chapter-31.pdf" },
    {},
  );

  const viewerNodes = tree.children.filter(
    (node) => node.type === "mdxJsxFlowElement" && node.name === "SlidesViewer",
  );
  assert.equal(viewerNodes.length, 1);
});

test("emits the configured component name", () => {
  const tree = makeTree([
    makeHeading(1, "Chapter 1"),
    makeHeading(2, "What You'll Learn"),
  ]);

  transform(
    tree,
    makeFile("/docs/chapter-1/README.md"),
    { source: "slides/chapter-1.pdf" },
    { component: "MyViewer" },
  );

  assert.notEqual(findViewerIndex(tree, "MyViewer"), -1);
  assert.equal(findViewerIndex(tree, "SlidesViewer"), -1);
});
