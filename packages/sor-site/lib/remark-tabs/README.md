# @vsor/lib-remark-tabs

One configurable tabs plugin — the collapse of the five near-identical remark
tab plugins that lived in `ag2/libs/docusaurus` at `d764f334` (surveyed in
`docs/extraction.md`: *never carry known duplication across a seam*).

## What the five originals shared

Every original was the same ~120-line transform: find a `containerDirective`,
split its children into sections on known `leafDirective` markers, emit JSX.
They differed **only** in configuration hardcoded around it:

| Original | Directive | Emitted | Hardcoded vocabulary |
| :--- | :--- | :--- | :--- |
| `remark-os-tabs` | `os-tabs` | `<Tabs groupId="operating-systems">` | windows*, windows-wsl, macos, linux |
| `remark-channel-tabs` | `channel-tabs` | `<Tabs groupId="messaging-channels">` | whatsapp*, telegram, discord |
| `remark-deploy-tabs` | `deploy-tabs` | `<Tabs groupId="deployment-path">` | managed*, vps-native, vps-docker |
| `remark-tool-tabs` | `tool-tabs` | a wrapper component + per-tab wrapper tags | claude-code, opencode |
| `remark-cowork-tabs` | `cowork-tabs` | a wrapper component + per-tab wrapper tags | cowork, openwork |

(* = carried the boolean `default` attribute.)

## The collapse

The shared transform is written once; everything that differed is config:

- **`directive`** — the container name to match.
- **`tabs`** — the vocabulary: `{ value: { label, default? } }` in Docusaurus
  mode, `{ value: { tag } }` in component mode.
- **`groupId`** — Docusaurus mode only; `<Tabs>` sync group.
- **`component`** — switches to component mode: emit this wrapper element with
  one `tag` element per tab (the tool/cowork shape).

Register once per tab set (after `remark-directive`), exactly as the five
originals were registered side by side. `presets.js` ships the three
Docusaurus-mode vocabularies verbatim (`osTabs`, `channelTabs`, `deployTabs`).
The two component-mode originals hardcoded wrapper components that do not cross
the seam (named in the surface spec's negative contract, not repeated here), so
they ship as a documented config shape, not as presets.

Behaviour quirks preserved verbatim (and pinned in `__tests__/`): document
order wins over config order; unknown leaf directives become tab content;
content before the first marker is dropped; an empty middle section still
yields a tab while an empty last section does not.

The originals shipped no tests; equivalence was verified 2026-08-13 by running
all five originals at `d764f334` against this plugin (matching preset/config)
on shared input trees and deep-comparing the output ASTs with
`assert.deepEqual` — identical node-for-node, 5/5.
