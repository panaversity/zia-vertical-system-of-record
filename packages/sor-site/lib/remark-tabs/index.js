/**
 * Remark Plugin: Configurable Tabs
 *
 * ONE configurable collapse of the five near-identical tab plugins that lived
 * in ag2 libs/docusaurus at d764f334 (remark-os-tabs, remark-channel-tabs,
 * remark-deploy-tabs, remark-tool-tabs, remark-cowork-tabs). Each of those
 * hardcoded a directive name and a tab vocabulary around the same transform;
 * here the vocabulary is config and the transform is written once — known
 * duplication never crosses the seam.
 *
 * Two emit modes, covering both upstream shapes:
 *
 * 1. Docusaurus mode (default — what os/channel/deploy tabs emitted):
 *    emits stock <Tabs groupId>/<TabItem value label [default]> from
 *    @theme/Tabs — works on stock preset-classic.
 *
 *    remarkTabs({
 *      directive: "os-tabs",
 *      groupId: "operating-systems",
 *      tabs: {
 *        windows: { label: "Windows", default: true },
 *        macos:   { label: "macOS" },
 *        linux:   { label: "Linux" },
 *      },
 *    })
 *
 * 2. Component mode (what tool/cowork tabs emitted): emits a custom wrapper
 *    component with one wrapper tag per tab — for synced-tab UIs the consuming
 *    site provides itself.
 *
 *    remarkTabs({
 *      directive: "tool-tabs",
 *      component: "ToolTabs",
 *      tabs: {
 *        "tool-a": { tag: "ToolAContent" },
 *        "tool-b": { tag: "ToolBContent" },
 *      },
 *    })
 *
 * Register once per tab set (after remark-directive), exactly as the five
 * originals were registered side by side:
 *
 *   remarkPlugins: [
 *     require('remark-directive'),
 *     [require('@vsor/lib-remark-tabs'), require('@vsor/lib-remark-tabs/presets').osTabs],
 *     [require('@vsor/lib-remark-tabs'), require('@vsor/lib-remark-tabs/presets').channelTabs],
 *   ]
 *
 * Markdown syntax (4 colons on the container so inner :::tip etc. still parse):
 *
 *   ::::os-tabs
 *
 *   ::windows
 *   Windows-specific content here
 *
 *   ::macos
 *   macOS-specific content here
 *
 *   ::::
 *
 * Behaviour preserved verbatim from the originals (all five shared it):
 * - tabs appear in document order, not config order;
 * - a leaf directive not in the vocabulary is treated as content of the
 *   current tab (or dropped if no tab is open yet);
 * - content before the first tab marker is dropped;
 * - an empty middle section still yields a tab; an empty LAST section does not
 *   (the final push is guarded by content length, as upstream).
 */

const { visit } = require("unist-util-visit");

function remarkTabs(options = {}) {
  const { directive, groupId, component, tabs } = options;

  if (!directive || typeof directive !== "string") {
    throw new Error(
      'remark-tabs: options.directive is required (e.g. "os-tabs")',
    );
  }
  if (!tabs || typeof tabs !== "object" || Object.keys(tabs).length === 0) {
    throw new Error(
      `remark-tabs (${directive}): options.tabs is required — the tab vocabulary, e.g. { windows: { label: "Windows", default: true } }`,
    );
  }
  if (component) {
    for (const [value, config] of Object.entries(tabs)) {
      if (!config || typeof config.tag !== "string") {
        throw new Error(
          `remark-tabs (${directive}): component mode requires a "tag" for every tab; missing on "${value}"`,
        );
      }
    }
  } else {
    for (const [value, config] of Object.entries(tabs)) {
      if (!config || typeof config.label !== "string") {
        throw new Error(
          `remark-tabs (${directive}): Docusaurus mode requires a "label" for every tab; missing on "${value}"`,
        );
      }
    }
  }

  return (tree) => {
    const nodesToTransform = [];

    // Find all containerDirective nodes with the configured name
    visit(tree, (node, index, parent) => {
      if (node.type === "containerDirective" && node.name === directive) {
        nodesToTransform.push({ node, index, parent });
      }
    });

    nodesToTransform.forEach(({ node, index, parent }) => {
      const tabItems = [];

      // Split children into sections on leaf directives from the vocabulary
      let currentTab = null;
      let currentContent = [];

      node.children.forEach((child) => {
        if (child.type === "leafDirective" && tabs[child.name]) {
          // Save previous section if one is open
          if (currentTab) {
            tabItems.push({ tab: currentTab, children: currentContent });
          }
          // Start new section
          currentTab = child.name;
          currentContent = [];
        } else if (currentTab) {
          // Add content to current section
          currentContent.push(child);
        }
      });

      // Don't forget the last section
      if (currentTab && currentContent.length > 0) {
        tabItems.push({ tab: currentTab, children: currentContent });
      }

      parent.children[index] = component
        ? buildComponentNode(component, tabs, tabItems)
        : buildDocusaurusTabsNode(groupId || directive, tabs, tabItems);
    });
  };
}

/** Emit <Tabs groupId>/<TabItem value label [default]> (os/channel/deploy shape). */
function buildDocusaurusTabsNode(groupId, tabs, tabItems) {
  return {
    type: "mdxJsxFlowElement",
    name: "Tabs",
    attributes: [
      {
        type: "mdxJsxAttribute",
        name: "groupId",
        value: groupId,
      },
    ],
    children: tabItems.map(({ tab, children }) => {
      const config = tabs[tab];
      const attributes = [
        {
          type: "mdxJsxAttribute",
          name: "value",
          value: tab,
        },
        {
          type: "mdxJsxAttribute",
          name: "label",
          value: config.label,
        },
      ];

      // Boolean `default` attribute on the configured default tab
      if (config.default) {
        attributes.push({
          type: "mdxJsxAttribute",
          name: "default",
          value: null,
        });
      }

      return {
        type: "mdxJsxFlowElement",
        name: "TabItem",
        attributes,
        children,
      };
    }),
  };
}

/** Emit <Component><TabTag>…</TabTag></Component> (tool/cowork shape). */
function buildComponentNode(component, tabs, tabItems) {
  return {
    type: "mdxJsxFlowElement",
    name: component,
    attributes: [],
    children: tabItems.map(({ tab, children }) => ({
      type: "mdxJsxFlowElement",
      name: tabs[tab].tag,
      attributes: [],
      children,
    })),
  };
}

module.exports = remarkTabs;
