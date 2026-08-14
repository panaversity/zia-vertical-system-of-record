/**
 * Preset vocabularies — the exact tab sets the collapsed originals hardcoded
 * at d764f334, verbatim (directive names, values, labels, defaults, groupIds).
 *
 * Only the three vocabularies that emit stock Docusaurus <Tabs> ship as
 * presets. The two component-mode originals hardcoded wrapper components that
 * do not cross the seam (they are named in the surface spec's negative
 * contract, and deliberately not repeated here — the boundary scan reads this
 * file) — a consuming site that has such components reproduces them with
 * component mode:
 *
 *   remarkTabs({
 *     directive: "tool-tabs",
 *     component: "MyToolTabs",
 *     tabs: {
 *       "tool-a": { tag: "ToolAContent" },
 *       "tool-b": { tag: "ToolBContent" },
 *     },
 *   })
 */

// remark-os-tabs
const osTabs = {
  directive: "os-tabs",
  groupId: "operating-systems",
  tabs: {
    windows: { label: "Windows", default: true },
    "windows-wsl": { label: "Windows (WSL)" },
    macos: { label: "macOS" },
    linux: { label: "Linux" },
  },
};

// remark-channel-tabs
const channelTabs = {
  directive: "channel-tabs",
  groupId: "messaging-channels",
  tabs: {
    whatsapp: { label: "WhatsApp", default: true },
    telegram: { label: "Telegram" },
    discord: { label: "Discord" },
  },
};

// remark-deploy-tabs
const deployTabs = {
  directive: "deploy-tabs",
  groupId: "deployment-path",
  tabs: {
    managed: { label: "Managed (Easiest)", default: true },
    "vps-native": { label: "VPS Native (Hands-on)" },
    "vps-docker": { label: "VPS Docker (Advanced)" },
  },
};

module.exports = { osTabs, channelTabs, deployTabs };
