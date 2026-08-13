// Ported from ag2 libs/docusaurus/remark-flashcards/__tests__/index.test.js
// at d764f334 — vitest translated to node:test (this workspace runs plugin
// tests with `node --test`, no extra test-runner dependency). Assertions are
// unchanged; vi.fn() is replaced by a minimal call-recording mock.

const test = require("node:test");
const assert = require("node:assert/strict");

const remarkFlashcards = require("../index.js");

function makeMockLoader(impl) {
  const calls = [];
  const returnQueue = [];
  const fn = (...args) => {
    calls.push(args);
    if (returnQueue.length > 0) return returnQueue.shift();
    if (fn.impl) return fn.impl(...args);
    return undefined;
  };
  fn.calls = calls;
  fn.impl = impl;
  fn.mockReturnValue = (v) => {
    fn.impl = () => v;
    return fn;
  };
  fn.mockReturnValueOnce = (v) => {
    returnQueue.push(v);
    return fn;
  };
  fn.mockImplementation = (impl2) => {
    fn.impl = impl2;
    return fn;
  };
  return fn;
}

function makeFCNode(attrs = []) {
  return {
    type: "mdxJsxFlowElement",
    name: "Flashcards",
    attributes: [...attrs],
    children: [],
  };
}

function makeTree(nodes) {
  return {
    type: "root",
    children: nodes || [makeFCNode()],
  };
}

function makeFile(filePath) {
  return { history: [filePath], path: filePath };
}

function getCardsAttr(node) {
  return node.attributes.find(
    (a) => a.type === "mdxJsxAttribute" && a.name === "cards",
  );
}

function getInjectedValue(node) {
  const attr = getCardsAttr(node);
  if (!attr) return undefined;
  return JSON.parse(attr.value.value);
}

test("injects cards prop when valid YAML exists", () => {
  const deck = {
    deck: { id: "test-deck", title: "Test Deck", version: 1 },
    cards: [{ id: "c1", front: "Q1?", back: "A1" }],
  };
  const mockLoader = makeMockLoader().mockReturnValue({
    filePath: "/docs/lesson.flashcards.yaml",
    deck,
  });

  const tree = makeTree([makeFCNode()]);
  const plugin = remarkFlashcards({ _loader: mockLoader });
  plugin(tree, makeFile("/docs/lesson.md"));

  const injected = getInjectedValue(tree.children[0]);
  assert.deepEqual(injected, deck);

  // Verify estree structure exists
  const attr = getCardsAttr(tree.children[0]);
  assert.equal(attr.value.data.estree.type, "Program");
  assert.equal(attr.value.data.estree.body[0].type, "ExpressionStatement");
});

test("injects cards={null} when no YAML file exists", () => {
  const mockLoader = makeMockLoader().mockReturnValue(null);

  const tree = makeTree([makeFCNode()]);
  const plugin = remarkFlashcards({ _loader: mockLoader });
  plugin(tree, makeFile("/docs/lesson.md"));

  const injected = getInjectedValue(tree.children[0]);
  assert.equal(injected, null);
});

test("throws when YAML is unparseable", () => {
  const mockLoader = makeMockLoader().mockImplementation(() => {
    throw new Error("Invalid YAML at line 3");
  });

  const tree = makeTree([makeFCNode()]);
  const plugin = remarkFlashcards({ _loader: mockLoader });

  assert.throws(
    () => plugin(tree, makeFile("/docs/lesson.md")),
    /remark-flashcards: failed to load flashcards for "\/docs\/lesson\.md"/,
  );
});

test("throws when deck is missing required id field", () => {
  const mockLoader = makeMockLoader().mockReturnValue({
    filePath: "/docs/lesson.flashcards.yaml",
    deck: { deck: {}, cards: [] },
  });

  const tree = makeTree([makeFCNode()]);
  const plugin = remarkFlashcards({ _loader: mockLoader });

  assert.throws(
    () => plugin(tree, makeFile("/docs/lesson.md")),
    /missing required "deck\.id" field/,
  );
});

test("throws when deck is missing cards array", () => {
  const mockLoader = makeMockLoader().mockReturnValue({
    filePath: "/docs/lesson.flashcards.yaml",
    deck: { deck: { id: "d1" } },
  });

  const tree = makeTree([makeFCNode()]);
  const plugin = remarkFlashcards({ _loader: mockLoader });

  assert.throws(
    () => plugin(tree, makeFile("/docs/lesson.md")),
    /missing required "cards" array/,
  );
});

test("normalizes backslashes in file paths", () => {
  const deck = {
    deck: { id: "d1", title: "D", version: 1 },
    cards: [{ id: "c1", front: "Q?", back: "A" }],
  };
  const mockLoader = makeMockLoader().mockReturnValue({ filePath: "x", deck });

  const tree = makeTree([makeFCNode()]);
  const plugin = remarkFlashcards({ _loader: mockLoader });
  plugin(tree, makeFile("C:\\Users\\docs\\lesson.md"));

  // mockLoader should receive forward slashes
  assert.deepEqual(mockLoader.calls[0], ["C:/Users/docs/lesson.md"]);
});

test("processes multiple Flashcards nodes independently", () => {
  const deck1 = {
    deck: { id: "d1", title: "D1", version: 1 },
    cards: [{ id: "c1", front: "Q1?", back: "A1" }],
  };
  const deck2 = {
    deck: { id: "d2", title: "D2", version: 1 },
    cards: [{ id: "c2", front: "Q2?", back: "A2" }],
  };

  const mockLoader = makeMockLoader()
    .mockReturnValueOnce({ filePath: "a", deck: deck1 })
    .mockReturnValueOnce({ filePath: "b", deck: deck2 });

  const node1 = makeFCNode();
  const node2 = makeFCNode();
  const tree = makeTree([node1, node2]);
  const plugin = remarkFlashcards({ _loader: mockLoader });
  plugin(tree, makeFile("/docs/lesson.md"));

  assert.deepEqual(getInjectedValue(tree.children[0]), deck1);
  assert.deepEqual(getInjectedValue(tree.children[1]), deck2);
  assert.equal(mockLoader.calls.length, 2);
});

test("skips nodes that already have a cards attribute", () => {
  const mockLoader = makeMockLoader().mockReturnValue(null);

  const existingAttr = {
    type: "mdxJsxAttribute",
    name: "cards",
    value: "explicit",
  };
  const tree = makeTree([makeFCNode([existingAttr])]);
  const plugin = remarkFlashcards({ _loader: mockLoader });
  plugin(tree, makeFile("/docs/lesson.md"));

  // Should not have called loader at all
  assert.equal(mockLoader.calls.length, 0);
  // Should still have only the original attribute
  assert.equal(tree.children[0].attributes.length, 1);
  assert.equal(tree.children[0].attributes[0].value, "explicit");
});
