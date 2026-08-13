/**
 * Docusaurus Chapter Manifest Plugin
 *
 * Creates a manifest of all docs organized by chapter at build time.
 * This enables components (e.g. per-chapter navigation or download actions)
 * to know every doc in a chapter.
 *
 * Data structure exposed via global data:
 * {
 *   chapters: {
 *     "02-Some-Part/05-some-chapter": {
 *       title: "Some Chapter",
 *       part: "Some Part",
 *       partPath: "02-Some-Part",
 *       lessons: [
 *         { id: "...", title: "First Lesson", slug: "/docs/...", order: 1 },
 *         ...
 *       ]
 *     }
 *   },
 *   docToChapter: {
 *     "02-Some-Part/05-some-chapter/01-first-lesson": "02-Some-Part/05-some-chapter"
 *   }
 * }
 *
 * Usage:
 * - Add to plugins array in docusaurus.config.ts
 * - Access in components via: useGlobalData()['docusaurus-chapter-manifest-plugin']
 */

const fs = require("fs");
const path = require("path");
const glob = require("glob");
const matter = require("gray-matter");

/**
 * Extract title from frontmatter or derive from path segment
 */
function extractTitle(filePath, frontmatter) {
  // Use frontmatter title if available
  if (frontmatter && frontmatter.title) {
    return frontmatter.title;
  }

  // Derive from filename: "01-origin-story.md" -> "Origin Story"
  const basename = path.basename(filePath, ".md");
  return basename
    .replace(/^\d+-/, "") // Remove leading numbers
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Extract order number from path segment
 * "01-origin-story" -> 1
 */
function extractOrder(segment) {
  const match = segment.match(/^(\d+)-/);
  return match ? parseInt(match[1], 10) : 999;
}

/**
 * Convert path segment to human-readable title
 * "05-some-chapter" -> "Some Chapter"
 */
function segmentToTitle(segment) {
  return segment
    .replace(/^\d+-/, "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const normalizeToDocId = require("@vsor/lib-shared/normalizeToDocId");

/**
 * Auto-detect parts that use section folders (Part > Section > Chapter > Lesson).
 * A section folder is identified by a _category_.json at depth 2 inside a part.
 */
function detectSectionedParts(docsDir) {
  const categoryFiles = glob.sync("*/*/_category_.json", {
    cwd: docsDir,
    absolute: false,
  });
  const parts = new Set();
  for (const f of categoryFiles) {
    parts.add(f.split("/")[0]);
  }
  return parts;
}

module.exports = function chapterManifestPlugin(context, options) {
  const { docsPath = "docs" } = options;

  return {
    name: "docusaurus-chapter-manifest-plugin",

    async loadContent() {
      const docsDir = path.join(context.siteDir, docsPath);
      const sectionedParts = detectSectionedParts(docsDir);
      const chapters = {};
      const docToChapter = {};

      // Find all markdown files (excluding .summary.md)
      const mdFiles = glob.sync("**/*.md", {
        cwd: docsDir,
        absolute: false,
        ignore: ["**/*.summary.md"],
      });

      console.log(`[Chapter Manifest] Found ${mdFiles.length} doc files`);

      for (const relativePath of mdFiles) {
        try {
          const fullPath = path.join(docsDir, relativePath);
          const content = fs.readFileSync(fullPath, "utf-8");
          const { data: frontmatter } = matter(content);

          // Parse path structure: "Part/Chapter/Lesson.md" or "Part/Chapter/README.md"
          const segments = relativePath.split("/");
          const filename = path.basename(relativePath);
          const isReadme = filename.toLowerCase() === "readme.md";

          // Skip files not in chapter structure (e.g., root-level files like preface.md)
          // README.md at Part/Chapter level needs exactly 3 segments
          // Lessons need 3+ segments
          if (segments.length < 3) {
            continue;
          }

          const partSegment = segments[0]; // e.g., "02-Some-Part"

          // Sectioned parts: Part > Section > Chapter > Lesson (4+ segments)
          // Other parts:     Part > Chapter > Lesson (3+ segments)
          let chapterSegment;
          if (sectionedParts.has(partSegment) && segments.length >= 4) {
            chapterSegment = segments[2]; // e.g., "14-some-chapter"
          } else if (sectionedParts.has(partSegment)) {
            // Section-level files (e.g., Section/README.md) — skip
            continue;
          } else {
            chapterSegment = segments[1]; // e.g., "05-some-chapter"
          }

          // Create chapter key (preserves numeric prefixes for sorting)
          const chapterKey = `${partSegment}/${chapterSegment}`;

          // Initialize chapter if not exists
          if (!chapters[chapterKey]) {
            chapters[chapterKey] = {
              title: segmentToTitle(chapterSegment),
              part: segmentToTitle(partSegment),
              partPath: partSegment,
              chapterPath: chapterSegment,
              lessons: [],
            };
          }

          // Build the slug (URL path) - Docusaurus normalizes this
          const docIdRaw = relativePath.replace(/\.md$/, "");
          const docId = normalizeToDocId(docIdRaw);

          // Map doc to its chapter (including README.md)
          docToChapter[docIdRaw] = chapterKey;
          docToChapter[docId] = chapterKey; // Also map normalized ID

          // Skip README.md from lessons array (it's the chapter intro, not a lesson)
          if (isReadme) {
            continue;
          }

          const lessonFile = segments.slice(2).join("/"); // e.g., "01-origin-story.md"

          // Extract lesson info
          const lessonBasename = path.basename(lessonFile, ".md");
          const lessonOrder = extractOrder(lessonBasename);
          const lessonTitle = extractTitle(fullPath, frontmatter);

          // Add lesson to chapter
          chapters[chapterKey].lessons.push({
            id: docIdRaw, // Original ID with numeric prefixes
            normalizedId: docId, // Normalized ID (Docusaurus format)
            title: lessonTitle,
            slug: frontmatter.slug
              ? `/docs${frontmatter.slug}`
              : `/docs/${docId}`,
            order: lessonOrder,
          });
        } catch (err) {
          console.warn(
            `[Chapter Manifest] Failed to process ${relativePath}:`,
            err.message,
          );
        }
      }

      // Sort lessons within each chapter by order
      for (const chapterKey of Object.keys(chapters)) {
        chapters[chapterKey].lessons.sort((a, b) => a.order - b.order);
      }

      console.log(
        `[Chapter Manifest] Built manifest with ${Object.keys(chapters).length} chapters`,
      );

      return { chapters, docToChapter };
    },

    async contentLoaded({ content, actions }) {
      const { setGlobalData } = actions;

      setGlobalData({
        chapters: content?.chapters || {},
        docToChapter: content?.docToChapter || {},
      });

      console.log(
        `[Chapter Manifest] Set global data with ${Object.keys(content?.chapters || {}).length} chapters`,
      );
    },
  };
};
