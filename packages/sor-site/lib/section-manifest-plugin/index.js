/**
 * Docusaurus plugin: the section manifest.
 *
 * Publishes, as global data, which folder of the corpus each document belongs to
 * and every document in that folder — the shape a per-section action needs
 * (`src/components/DocPageActions` uses it to offer "download this section").
 *
 * Provenance: copied from the teaching-material plugin surveyed in this
 * framework's `docs/extraction.md` at the pinned SHA (d764f334), and rewritten
 * on the way across in the two ways that matter.
 *
 * 1. VOCABULARY. Upstream was named throughout for the teaching material it was
 *    written for, and those names reached a reader: the package id, the
 *    global-data key, and two `console.log` lines that announced a count of them
 *    on every single build. A vsor corpus is documents in folders, and the
 *    owner of a tax-law corpus should not have to read somebody's teaching
 *    vocabulary on their own console. The framework's word is SECTION, and it
 *    is a section everywhere now: package, plugin name, data key, keys inside.
 *
 * 2. WHAT A SECTION IS. Upstream hardcoded its own three-level directory
 *    convention, with a `_category_.json` probe to detect a fourth level — so a
 *    document had to be at least three segments deep to belong to anything, and
 *    against a corpus shaped any other way the manifest came out empty. Here a
 *    section is simply THE FOLDER THE DOCUMENT IS IN, at any depth, which is the
 *    only definition that is true of a corpus nobody designed for this plugin.
 *    A document at the corpus root belongs to no section, which is correct: the
 *    root is not a section, it is the corpus.
 *
 * Global data:
 * {
 *   sections: {
 *     "handbook/appeals": {                     // the folder, relative to the corpus
 *       title: "Appeals",                       // its last segment, humanized
 *       parent: "Handbook",                     // the folder above it, humanized ("" at top level)
 *       parentPath: "handbook",
 *       sectionPath: "handbook/appeals",
 *       documents: [ { id, normalizedId, title, slug, order }, … ]
 *     }
 *   },
 *   docToSection: { "handbook/appeals/01-filing": "handbook/appeals", … }
 * }
 *
 * Read it with `usePluginData("docusaurus-section-manifest-plugin")`.
 */

const fs = require("fs");
const path = require("path");
const glob = require("glob");
const matter = require("gray-matter");

const normalizeToDocId = require("@vsor/lib-shared/normalizeToDocId");

/** Frontmatter title when there is one, else the filename humanized. */
function extractTitle(filePath, frontmatter) {
  if (frontmatter && frontmatter.title) {
    return frontmatter.title;
  }
  return segmentToTitle(path.basename(filePath, ".md"));
}

/** "01-origin-story" -> 1; unnumbered files sort last, in name order. */
function extractOrder(segment) {
  const match = segment.match(/^(\d+)-/);
  return match ? parseInt(match[1], 10) : 999;
}

/** "05-filing-an-appeal" -> "Filing An Appeal". */
function segmentToTitle(segment) {
  return segment
    .replace(/^\d+-/, "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

module.exports = function sectionManifestPlugin(context, options) {
  const { docsPath = "docs" } = options;

  return {
    name: "docusaurus-section-manifest-plugin",

    async loadContent() {
      const docsDir = path.join(context.siteDir, docsPath);
      const sections = {};
      const docToSection = {};

      const mdFiles = glob.sync("**/*.md", {
        cwd: docsDir,
        absolute: false,
        ignore: ["**/*.summary.md"],
      });

      for (const relativePath of mdFiles) {
        try {
          const fullPath = path.join(docsDir, relativePath);
          const content = fs.readFileSync(fullPath, "utf-8");
          const { data: frontmatter } = matter(content);

          const segments = relativePath.split("/");
          const filename = path.basename(relativePath);
          const isReadme = filename.toLowerCase() === "readme.md";

          // A document at the corpus root belongs to no section.
          if (segments.length < 2) {
            continue;
          }

          const folder = segments.slice(0, -1);
          const sectionKey = folder.join("/");
          const parentPath = folder.slice(0, -1).join("/");

          if (!sections[sectionKey]) {
            sections[sectionKey] = {
              title: segmentToTitle(folder[folder.length - 1]),
              parent: parentPath ? segmentToTitle(folder[folder.length - 2]) : "",
              parentPath,
              sectionPath: sectionKey,
              documents: [],
            };
          }

          const docIdRaw = relativePath.replace(/\.md$/, "");
          const docId = normalizeToDocId(docIdRaw);

          // The folder's own index page belongs to the section but is not one of
          // its documents — it is the page a reader is already on when they ask
          // for the section.
          docToSection[docIdRaw] = sectionKey;
          docToSection[docId] = sectionKey;
          if (isReadme) {
            continue;
          }

          const basename = path.basename(relativePath, ".md");
          sections[sectionKey].documents.push({
            id: docIdRaw,
            normalizedId: docId,
            title: extractTitle(fullPath, frontmatter),
            slug: frontmatter.slug ? `/docs${frontmatter.slug}` : `/docs/${docId}`,
            order: extractOrder(basename),
          });
        } catch (err) {
          // A document this plugin cannot read is a real failure worth naming —
          // and the only thing this plugin prints. It never announces success:
          // a per-build "found N documents" line is the framework talking about
          // itself on somebody else's console.
          console.warn(
            `[vsor] section manifest: could not read ${relativePath}: ${err.message}`,
          );
        }
      }

      for (const key of Object.keys(sections)) {
        sections[key].documents.sort(
          (a, b) => a.order - b.order || a.id.localeCompare(b.id),
        );
      }

      // A folder holding nothing but its own index page is not a section a
      // reader can be offered — the action that consumes this would render
      // "Download section (0 pages)". Drop it, and drop the mappings that point
      // at it, so a consumer never holds a key that resolves to an empty group.
      // (Verified 2026-08-14 against a two-level corpus: `handbook/` with only a
      // README, `handbook/appeals/` with two documents.)
      for (const key of Object.keys(sections)) {
        if (sections[key].documents.length > 0) continue;
        delete sections[key];
        for (const docId of Object.keys(docToSection)) {
          if (docToSection[docId] === key) delete docToSection[docId];
        }
      }

      return { sections, docToSection };
    },

    async contentLoaded({ content, actions }) {
      actions.setGlobalData({
        sections: content?.sections || {},
        docToSection: content?.docToSection || {},
      });
    },
  };
};
