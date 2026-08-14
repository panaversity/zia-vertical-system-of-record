// This site is yours. Every value here is a live seam — edit it and the built
// site changes. The knowledge itself lives in ../knowledge; this file only
// decides how it is presented.
import type * as Preset from "@docusaurus/preset-classic";
import type { Config } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

const config: Config = {
  title: "__VSOR_NAME__",
  // The sentence under the title on your homepage. Say what this covers.
  tagline: "The system of record for __VSOR_NAME__",
  url: "http://localhost:3000", // set to your real domain when you deploy
  baseUrl: "/",
  i18n: { defaultLocale: "en", locales: ["en"] },

  // Three packages, all shipped with vsor and resolved at build time. Each line
  // is visible and deletable:
  //   sor-site-mdx    the content vocabulary (Quiz, Flashcards, …)
  //   search-local    the search index, built into the site — no service to call
  //   sor-site-theme  the design system: the navigation, the doc pages, and the
  //                   <Landing /> your homepage renders. Delete this line and the
  //                   site falls back to stock Docusaurus styling with every
  //                   content primitive intact — rewrite src/pages/index.tsx too,
  //                   since it is the one file that uses the theme's <Landing />.
  themes: [
    "@vsor/sor-site-mdx",
    "@easyops-cn/docusaurus-search-local",
    // last, so its search box shadows the search plugin's own
    "@vsor/sor-site-theme",
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          path: "../knowledge",
          routeBasePath: "docs",
          // ./sidebars.ts generates the sidebar from the folder tree and names it
          // `tutorialSidebar` — the ecosystem's name, so imported documents build
          sidebarPath: "./sidebars.ts",
        },
        blog: false,
        theme: { customCss: "./src/css/custom.css" },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: "__VSOR_NAME__",
      // Add your own entries here — anything Docusaurus documents works
      // ({to}/{href} links, dropdowns, doc links, position: "left" | "right").
      // `icon` is this theme's one addition: the name of a lucide icon. It is
      // consumed by @vsor/sor-site-theme's navbar and never forwarded; delete
      // that theme and Docusaurus passes it through as an inert `icon=""`
      // attribute on the link (measured — no warning, no error, no styling).
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
  } satisfies Preset.ThemeConfig,
};

export default config;
