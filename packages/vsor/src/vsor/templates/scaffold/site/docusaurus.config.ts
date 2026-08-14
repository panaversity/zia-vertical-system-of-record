// This site is yours. Every value here is a live seam — edit it and the built
// site changes. The knowledge itself lives in ../knowledge; this file only
// decides how it is presented.
//
// ── How this file is used ────────────────────────────────────────────────────
// `vsor dev` and `vsor build` install a Docusaurus site under `.vsor/` — the
// runtime shell — and load THIS file over it. The merge is one rule: your value
// wins, at every depth. Objects merge key by key (setting `navbar.title` leaves
// the rest of the navbar alone); arrays replace whole (writing `navbar.items`
// gives you the entire list, including dropping what shipped).
//
// Six keys belong to the runtime and are ignored here, with a warning if you set
// them: `presets`, `plugins`, `themes`, `markdown`, `future`, `staticDirectories`.
// They are the machinery — the corpus pipeline, the search index, the build
// flags, the asset layering — not your site's identity. That is the whole
// bargain: the machinery is upgraded for you, and everything you author stays in
// this directory.
//
// ── The other four seams are files, not values ───────────────────────────────
//   src/css/custom.css   loaded AFTER the runtime's stylesheet — any design
//                        token you redeclare wins on cascade order
//   src/pages/           your pages replace the runtime's (so this project's
//                        homepage is index.tsx beside this file)
//   sidebars.ts          your sidebar file replaces the runtime's
//   static/             your assets are copied over the runtime's, same path
//
// Nothing else is needed: `url`, `baseUrl` and the whole of `themeConfig` are
// yours to set, exactly as the Docusaurus documentation describes them.
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

const config: Partial<Config> = {
  title: "__VSOR_NAME__",
  // The sentence under the title on your homepage. Say what this covers.
  tagline: "The system of record for __VSOR_NAME__",
  url: "http://localhost:3000", // set to your real domain when you deploy
  baseUrl: "/",

  themeConfig: {
    navbar: {
      title: "__VSOR_NAME__",
      // Add your own entries here — anything Docusaurus documents works
      // ({to}/{href} links, dropdowns, doc links, position: "left" | "right").
      // `icon` is the runtime's one addition: the name of a lucide icon from its
      // own allowlist. An unknown name renders no icon and never breaks a build.
      items: [
        {
          // "tutorialSidebar" is the sidebar ./sidebars.ts generates from the
          // knowledge/ folder tree; this link opens its first document, so it
          // keeps working when documents are added, renamed or removed.
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          label: "Knowledge",
          position: "left",
          icon: "BookOpen",
        },
      ],
    },
    footer: { copyright: `© __VSOR_YEAR__ __VSOR_NAME__` },
    // Code blocks. Without this, Docusaurus falls back to its palenight theme —
    // a DARK theme — while the design system paints the code surface light, and
    // every fenced block is pale-on-pale in light mode (measured 1.3:1). Pick
    // any pair from prism-react-renderer's `themes`.
    prism: { theme: prismThemes.github, darkTheme: prismThemes.dracula },
  },
};

export default config;
