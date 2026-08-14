// Tests for the five-into-one tabs collapse. The AST expectations here were
// verified against the original plugins at ag2 d764f334 by running
// remark-os-tabs, remark-channel-tabs and the component-mode plugin on the same input
// trees and deep-comparing outputs (see the extraction report, 2026-08-13):
// with the matching preset/config, output is identical node-for-node.

const test = require("node:test");
const assert = require("node:assert/strict");

const remarkTabs = require("../index.js");
const { osTabs, channelTabs, deployTabs } = require("../presets.js");

function leaf(name) {
  return { type: "leafDirective", name, children: [] };
}

function para(text) {
  return { type: "paragraph", children: [{ type: "text", value: text }] };
}

function container(name, children) {
  return { type: "containerDirective", name, children };
}

function tree(children) {
  return { type: "root", children };
}

function attrsOf(node) {
  return Object.fromEntries(node.attributes.map((a) => [a.name, a.value]));
}

test("os preset reproduces remark-os-tabs output", () => {
  const t = tree([
    container("os-tabs", [
      leaf("windows"),
      para("win content"),
      leaf("macos"),
      para("mac content"),
      leaf("linux"),
      para("linux content"),
    ]),
  ]);

  remarkTabs(osTabs)(t);

  const tabs = t.children[0];
  assert.equal(tabs.type, "mdxJsxFlowElement");
  assert.equal(tabs.name, "Tabs");
  assert.deepEqual(attrsOf(tabs), { groupId: "operating-systems" });

  assert.equal(tabs.children.length, 3);
  const [win, mac, linux] = tabs.children;

  assert.equal(win.name, "TabItem");
  // `default: null` is the boolean JSX attribute, exactly as upstream emitted
  assert.deepEqual(attrsOf(win), {
    value: "windows",
    label: "Windows",
    default: null,
  });
  assert.deepEqual(win.children, [para("win content")]);

  assert.deepEqual(attrsOf(mac), { value: "macos", label: "macOS" });
  assert.deepEqual(attrsOf(linux), { value: "linux", label: "Linux" });
});

test("channel preset reproduces remark-channel-tabs output", () => {
  const t = tree([
    para("before"),
    container("channel-tabs", [
      leaf("telegram"),
      para("tg content"),
      leaf("whatsapp"),
      para("wa content"),
    ]),
    para("after"),
  ]);

  remarkTabs(channelTabs)(t);

  assert.deepEqual(t.children[0], para("before"));
  assert.deepEqual(t.children[2], para("after"));

  const tabs = t.children[1];
  assert.equal(tabs.name, "Tabs");
  assert.deepEqual(attrsOf(tabs), { groupId: "messaging-channels" });

  // Document order wins over config order (telegram authored first)
  assert.equal(tabs.children.length, 2);
  assert.deepEqual(attrsOf(tabs.children[0]), {
    value: "telegram",
    label: "Telegram",
  });
  // whatsapp keeps its `default` marker wherever it appears
  assert.deepEqual(attrsOf(tabs.children[1]), {
    value: "whatsapp",
    label: "WhatsApp",
    default: null,
  });
});

test("deploy preset carries the deploy vocabulary", () => {
  const t = tree([
    container("deploy-tabs", [
      leaf("managed"),
      para("managed content"),
      leaf("vps-docker"),
      para("docker content"),
    ]),
  ]);

  remarkTabs(deployTabs)(t);

  const tabs = t.children[0];
  assert.deepEqual(attrsOf(tabs), { groupId: "deployment-path" });
  assert.deepEqual(attrsOf(tabs.children[0]), {
    value: "managed",
    label: "Managed (Easiest)",
    default: null,
  });
  assert.deepEqual(attrsOf(tabs.children[1]), {
    value: "vps-docker",
    label: "VPS Docker (Advanced)",
  });
});

test("component mode reproduces the upstream component-mode output shape", () => {
  const t = tree([
    container("editor-tabs", [
      leaf("editor-a"),
      para("a content"),
      leaf("editor-b"),
      para("b content"),
    ]),
  ]);

  remarkTabs({
    directive: "editor-tabs",
    component: "MyEditorTabs",
    tabs: {
      "editor-a": { tag: "EditorAContent" },
      "editor-b": { tag: "EditorBContent" },
    },
  })(t);

  const wrapper = t.children[0];
  assert.equal(wrapper.type, "mdxJsxFlowElement");
  assert.equal(wrapper.name, "MyEditorTabs");
  assert.deepEqual(wrapper.attributes, []);

  assert.equal(wrapper.children.length, 2);
  assert.equal(wrapper.children[0].name, "EditorAContent");
  assert.deepEqual(wrapper.children[0].attributes, []);
  assert.deepEqual(wrapper.children[0].children, [para("a content")]);
  assert.equal(wrapper.children[1].name, "EditorBContent");
});

test("content before the first marker is dropped (upstream quirk kept)", () => {
  const t = tree([
    container("os-tabs", [para("orphan"), leaf("macos"), para("mac content")]),
  ]);

  remarkTabs(osTabs)(t);

  const tabs = t.children[0];
  assert.equal(tabs.children.length, 1);
  assert.deepEqual(tabs.children[0].children, [para("mac content")]);
});

test("unknown leaf directive is treated as tab content (upstream quirk kept)", () => {
  const unknown = leaf("solaris");
  const t = tree([
    container("os-tabs", [leaf("linux"), unknown, para("linux content")]),
  ]);

  remarkTabs(osTabs)(t);

  const tabs = t.children[0];
  assert.equal(tabs.children.length, 1);
  assert.deepEqual(tabs.children[0].children, [unknown, para("linux content")]);
});

test("empty middle section yields a tab; empty last section does not (upstream quirk kept)", () => {
  const t = tree([
    container("os-tabs", [
      leaf("windows"),
      leaf("macos"),
      para("mac content"),
      leaf("linux"),
    ]),
  ]);

  remarkTabs(osTabs)(t);

  const tabs = t.children[0];
  assert.equal(tabs.children.length, 2);
  assert.deepEqual(attrsOf(tabs.children[0]).value, "windows");
  assert.deepEqual(tabs.children[0].children, []);
  assert.deepEqual(attrsOf(tabs.children[1]).value, "macos");
});

test("other directives and other tab sets are left untouched", () => {
  const other = container("channel-tabs", [leaf("whatsapp"), para("wa")]);
  const t = tree([other]);

  remarkTabs(osTabs)(t);

  assert.equal(t.children[0], other);
  assert.equal(t.children[0].type, "containerDirective");
});

test("config validation: directive, tabs, labels, tags", () => {
  assert.throws(() => remarkTabs({}), /options\.directive is required/);
  assert.throws(
    () => remarkTabs({ directive: "x-tabs" }),
    /options\.tabs is required/,
  );
  assert.throws(
    () => remarkTabs({ directive: "x-tabs", tabs: { a: {} } }),
    /requires a "label" for every tab; missing on "a"/,
  );
  assert.throws(
    () =>
      remarkTabs({ directive: "x-tabs", component: "XTabs", tabs: { a: {} } }),
    /requires a "tag" for every tab; missing on "a"/,
  );
});
