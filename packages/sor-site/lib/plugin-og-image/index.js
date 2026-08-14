/**
 * Docusaurus Plugin: Open Graph image generation
 *
 * Copied from ag2 libs/docusaurus/plugin-og-image at d764f334.
 * Changes on the way across the seam:
 * - all card text comes from config: the badge line and footer text are
 *   plugin options (defaulting to siteConfig.title and the siteConfig.url
 *   hostname), card colors are options — no product strings, no product
 *   palette baked in;
 * - the upstream homepage special case (a hardcoded book-cover marketing
 *   asset) is gone: the homepage gets a generated card like every other flat
 *   route;
 * - the secondary-locale skip branch is gone (i18n is deferred wholesale
 *   post-v0; the default locale builds alone).
 *
 * Fonts are bundled (Inter, self-hosted) — the theme introduces no external
 * requests, at build time or runtime.
 *
 * Usage in docusaurus.config.ts:
 * ```js
 * plugins: [
 *   [require('@vsor/lib-plugin-og-image'), {
 *     card: {
 *       badge: "Example Docs",          // default: siteConfig.title
 *       footer: "docs.example.com",     // default: hostname of siteConfig.url
 *       background: "#1a1a2e",
 *       backgroundImage: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
 *       accent: "#5ee0e4",
 *     },
 *   }],
 * ]
 * ```
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_CARD = {
  background: "#1a1a2e",
  backgroundImage:
    "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
  accent: "#5ee0e4",
};

/** Resolve the card style + text config from options and siteConfig. */
function resolveCard(siteConfig, options = {}) {
  const card = { ...DEFAULT_CARD, ...(options.card || {}) };
  if (!card.badge) card.badge = siteConfig.title || "";
  if (!card.footer) {
    try {
      card.footer = new URL(siteConfig.url).hostname;
    } catch {
      card.footer = siteConfig.url || "";
    }
  }
  return card;
}

const verbose = process.env.VERBOSE_DOCUSAURUS_PLUGINS === "true";

let sharpInstance;
const getSharp = () => {
  if (!sharpInstance) {
    sharpInstance = require("sharp");
    // Limit sharp concurrency to reduce memory usage on constrained build machines.
    sharpInstance.concurrency(1);
  }
  return sharpInstance;
};

// Satori is ESM-only, we'll use dynamic import
let satori;
const initSatori = async () => {
  if (!satori) {
    satori = (await import("satori")).default;
  }
  return satori;
};

// Cache fonts globally to avoid repeated file reads (major memory savings)
let cachedFonts = null;
const loadFontsOnce = () => {
  if (cachedFonts) return cachedFonts;

  // Bundled fonts (Inter) - these are included in the plugin and work on all platforms
  const bundledFontsDir = path.join(__dirname, "fonts");
  const bundledFonts = [
    { name: "Inter", weight: 400, file: "Inter-Regular.ttf" },
    { name: "Inter", weight: 700, file: "Inter-Bold.ttf" },
  ];

  // System font fallbacks (only used if bundled fonts are missing)
  const systemFonts = [
    {
      name: "Sans",
      weight: 400,
      paths: [
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "C:/Windows/Fonts/arial.ttf",
      ],
    },
    {
      name: "Sans",
      weight: 700,
      paths: [
        "/Library/Fonts/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
      ],
    },
  ];

  // Try bundled fonts first (preferred - works on any CI/build host)
  cachedFonts = bundledFonts
    .map((font) => {
      const fontPath = path.join(bundledFontsDir, font.file);
      try {
        if (fs.existsSync(fontPath)) {
          return {
            name: font.name,
            data: fs.readFileSync(fontPath),
            weight: font.weight,
            style: "normal",
          };
        }
      } catch {
        // Ignore errors, fall through to system fonts
      }
      return null;
    })
    .filter(Boolean);

  // If bundled fonts loaded, use them
  if (cachedFonts.length >= 2) {
    console.log("  Using bundled Inter fonts");
    return cachedFonts;
  }

  // Fallback to system fonts
  console.log("  Bundled fonts not found, trying system fonts...");
  cachedFonts = systemFonts
    .map((c) => {
      const found = c.paths.find((p) => {
        try {
          return fs.existsSync(p);
        } catch {
          return false;
        }
      });
      if (!found) return null;
      return {
        name: c.name,
        data: fs.readFileSync(found),
        weight: c.weight,
        style: "normal",
      };
    })
    .filter(Boolean);

  if (!cachedFonts.length) {
    throw new Error(
      "No fonts found. Bundled Inter fonts missing and no system fonts available.",
    );
  }

  return cachedFonts;
};

/**
 * Run OG image generation against a built site. Exposed so a build
 * orchestrator can call it from a fresh node process (avoids inheriting the
 * docusaurus build's webpack/MDX heap — found live upstream: the shared heap
 * caused OOM kills on constrained build machines).
 *
 * @param {object} args
 * @param {string} args.siteDir   Absolute path to the site dir (parent of docs/)
 * @param {string} args.outDir    Absolute path to the build output (build/)
 * @param {object} args.siteConfig  Minimal config: { title, tagline, url }
 * @param {object} [args.options]   Plugin options ({ card: { ... } })
 */
async function runOGGeneration({ siteDir, outDir, siteConfig, options = {} }) {
  console.log("\n🎨 Generating Open Graph images...\n");

  const card = resolveCard(siteConfig, options);

  try {
    loadFontsOnce();
    console.log("  ✓ Fonts loaded and cached\n");
  } catch (err) {
    console.log(`  ⚠ Font loading failed: ${err.message}`);
    console.log("  ⚠ OG image generation will be skipped\n");
    return;
  }

  const ogOutDir = path.join(outDir, "img", "og");
  if (!fs.existsSync(ogOutDir)) {
    fs.mkdirSync(ogOutDir, { recursive: true });
  }

  await generateOGImage({
    title: siteConfig.title,
    description: siteConfig.tagline,
    slug: "home",
    ogDir: ogOutDir,
    card,
  });

  const docsDir = path.join(siteDir, "docs");
  await generateImagesFromDirectory(docsDir, ogOutDir, card, docsDir);

  await injectOGImagesIntoHTML(outDir, siteConfig, card);

  console.log("\n✅ Open Graph images generated and injected successfully!\n");
}

/**
 * Docusaurus plugin to automatically generate Open Graph images for each page.
 *
 * NOTE: a build orchestrator may prefer running runOGGeneration in a separate
 * node process AFTER `docusaurus build` exits (cleaner heap on constrained
 * machines); this postBuild covers direct `docusaurus build` invocations.
 * Set SKIP_OG_IMAGES=true to disable it.
 */
module.exports = function (context, options) {
  return {
    name: "docusaurus-plugin-og-image-generator",

    async postBuild({ siteConfig, routesPaths, outDir }) {
      if (process.env.SKIP_OG_IMAGES === "true") {
        console.log(
          "\n🎨 Skipping OG image generation (SKIP_OG_IMAGES=true)\n",
        );
        return;
      }
      await runOGGeneration({
        siteDir: context.siteDir,
        outDir,
        siteConfig,
        options,
      });
    },
  };
};

module.exports.runOGGeneration = runOGGeneration;

/**
 * Which pages get a generated per-page OG card vs. fall back to the static
 * og-image.jpg declared in themeConfig.
 *
 * A card goes ONLY to flat, single-segment routes — the shareable surface:
 *   - top-level docs with flat `slug:` overrides (→ /docs/<name>),
 *   - Part/section landing pages (Docusaurus strips the numeric prefix, so
 *     docs/00-Some-Part/README → /docs/Some-Part, still flat),
 *   - standalone landing/catalog pages and custom top-level pages,
 *   - the homepage.
 *
 * Nested routes are skipped — they fall back to og-image.jpg: deep content
 * lives at /docs/<folder>/<subfolder>/<doc>, i.e. ≥1 slash once the leading
 * `docs/` is stripped. Measured upstream (2026): that is the >1,000-page bulk
 * none of which is shared individually — kept off the render path so OG
 * generation does not dominate build time or output/cache size.
 *
 * NOTE: the numeric prefix is stripped from the URL, so a route-level check
 * cannot look for "NN-"; flatness (no "/") is the reliable signal because
 * shareable pages use flat slugs and deep content is always folder-nested.
 *
 * `slug` is the route/path with the `docs/` prefix already stripped,
 * forward slashes, no leading slash.
 */
function getsOwnOGCard(slug) {
  return !slug.includes("/");
}
module.exports.getsOwnOGCard = getsOwnOGCard;

/**
 * Recursively scan docs directory and collect all markdown files
 */
function collectMarkdownFiles(dir, docsRoot, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      collectMarkdownFiles(fullPath, docsRoot, files);
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) &&
      !entry.name.endsWith(".summary.md") // Skip summary files
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Process markdown files in batches, skipping unchanged files via content hash.
 *
 * A `.og-cache.json` file in ogDir maps slug → md5(title|description).
 * If the hash matches AND the PNG already exists, we skip regeneration.
 * This reduces a typical incremental build from ~1,800 images to only the
 * handful of files whose title or description actually changed.
 */
async function generateImagesFromDirectory(dir, ogDir, card, docsRoot) {
  const files = collectMarkdownFiles(dir, docsRoot);
  const BATCH_SIZE = 10;
  let processed = 0;
  let skipped = 0;

  console.log(`  Found ${files.length} markdown files to process\n`);

  // Load content-hash cache from previous build (hosts that preserve build output skip regeneration)
  const cachePath = path.join(ogDir, ".og-cache.json");
  let cache = {};
  try {
    if (fs.existsSync(cachePath)) {
      cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
    }
  } catch {
    // Corrupted cache — regenerate everything
    cache = {};
  }

  const newCache = {};

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);

    for (const fullPath of batch) {
      const content = fs.readFileSync(fullPath, "utf-8");
      const metadata = extractFrontMatter(content);

      if (metadata.title) {
        const relativePath = path.relative(docsRoot, fullPath);
        const slug = relativePath.replace(/\\/g, "/").replace(/\.mdx?$/, "");

        // Only flat single-segment routes (flat-slug docs, landing/Part pages)
        // get a card; nested pages fall back to the
        // static og-image.jpg. (Slug here is the source path; the injection pass
        // is the authoritative gate and regenerates kept pages on demand.)
        if (!getsOwnOGCard(slug)) {
          skipped++;
          processed++;
          continue;
        }

        const filename = slug.replace(/\//g, "-") + ".png";
        const imagePath = path.join(ogDir, filename);

        // Hash title + description to detect content changes
        const hash = crypto
          .createHash("md5")
          .update(metadata.title + "|" + (metadata.description || ""))
          .digest("hex");

        newCache[slug] = hash;

        // Skip if hash matches previous build AND image file exists
        if (cache[slug] === hash && fs.existsSync(imagePath)) {
          skipped++;
          processed++;
          continue;
        }

        await generateOGImage({
          title: metadata.title,
          description: metadata.description || "",
          slug,
          ogDir,
          card,
        });
      }
      processed++;
    }

    // Clear sharp's internal cache and hint GC between batches to reduce memory
    const sharp = getSharp();
    sharp.cache(false);
    sharp.cache(true);
    if (global.gc) {
      global.gc();
    }

    // Progress update every batch
    if (
      verbose &&
      (processed % BATCH_SIZE === 0 || processed === files.length)
    ) {
      console.log(`  Progress: ${processed}/${files.length} docs processed`);
    }
  }

  // Persist cache for next build
  fs.writeFileSync(cachePath, JSON.stringify(newCache), "utf-8");

  const generated = processed - skipped;
  console.log(
    `  Cache: ${skipped} unchanged (skipped), ${generated} generated`,
  );
}

/**
 * Extract front matter from markdown content
 */
function extractFrontMatter(content) {
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---/;
  const match = content.match(frontMatterRegex);

  if (!match) {
    return {};
  }

  const frontMatter = {};
  const lines = match[1].split("\n");

  for (const line of lines) {
    const [key, ...valueParts] = line.split(":");
    if (key && valueParts.length > 0) {
      const value = valueParts
        .join(":")
        .trim()
        .replace(/^["']|["']$/g, "");
      frontMatter[key.trim()] = value;
    }
  }

  return frontMatter;
}

/**
 * Inject OG image meta tags into built HTML files
 */
async function injectOGImagesIntoHTML(outDir, siteConfig, card) {
  console.log("\n🔧 Injecting OG images into HTML files...\n");

  const htmlFiles = [];

  // Recursively find all HTML files
  function findHTMLFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findHTMLFiles(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".html")) {
        htmlFiles.push(fullPath);
      }
    }
  }

  findHTMLFiles(outDir);

  console.log(`  Found ${htmlFiles.length} HTML files to process\n`);

  // Look for generated images inside the built output directory
  const ogImagesDir = path.join(outDir, "img", "og");

  // Stable version token per build, overridable from env/CI
  const buildVersion =
    process.env.BUILD_VERSION || String(Math.floor(Date.now() / 1000));

  let processed = 0;
  const BATCH_SIZE = 50;

  for (const htmlFile of htmlFiles) {
    processed++;
    try {
      let html = fs.readFileSync(htmlFile, "utf-8");

      // Extract the path from the HTML file location
      const relativePath = path.relative(outDir, htmlFile);

      // Convert HTML path to slug (similar to how we generate images)
      let slug = relativePath
        .replace(/\\/g, "/")
        .replace(/\.html$/, "")
        .replace(/\/index$/, ""); // Remove trailing /index

      // Handle special cases
      if (slug === "index" || slug === "") {
        slug = "home";
      }

      // For docs pages, remove the "docs/" prefix to match generated image names
      if (slug.startsWith("docs/")) {
        slug = slug.replace(/^docs\//, "");
      }

      // Convert to OG image filename
      const imageFilename = slug.replace(/\//g, "-") + ".png";
      const ogImagePath = path.join(ogImagesDir, imageFilename);

      // Homepage: uses the generated home.png card like every other flat
      // route (upstream's hardcoded book-cover marketing asset stays behind).

      // Only flat single-segment routes get a card (see getsOwnOGCard).
      // Nested pages keep the og-image.jpg default — skip on-demand
      // generation + injection for them.
      if (!getsOwnOGCard(slug)) {
        continue;
      }

      // Ensure OG image exists for this page (generate on demand if missing)
      if (!fs.existsSync(ogImagePath)) {
        // Try to derive title/description from existing meta tags
        const titleMatch =
          html.match(
            /<meta[^>]*property="og:title"[^>]*content="([^"]+)"[^>]*>/i,
          ) || html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const descMatch =
          html.match(
            /<meta[^>]*name="description"[^>]*content="([^"]+)"[^>]*>/i,
          ) ||
          html.match(
            /<meta[^>]*property="og:description"[^>]*content="([^"]+)"[^>]*>/i,
          );

        const title = titleMatch ? (titleMatch[1] || "").trim() : "";
        const description = descMatch ? (descMatch[1] || "").trim() : "";

        try {
          await generateOGImage({
            title: title || siteConfig.title,
            description: description || siteConfig.tagline || "",
            slug,
            ogDir: ogImagesDir,
            card,
          });
        } catch (err) {
          console.log(
            `  ⚠ Failed to generate OG image for ${slug}: ${err.message}`,
          );
        }
      }

      if (fs.existsSync(ogImagePath)) {
        const imageUrl = `${siteConfig.url}/img/og/${imageFilename}?v=${buildVersion}`;
        // Build canonical page URL for better social parsing
        let pagePath = "";
        if (slug === "home") {
          pagePath = "/";
        } else if (relativePath.startsWith("docs/")) {
          pagePath = `/docs/${slug}`;
        } else {
          pagePath = `/${slug}`;
        }
        const pageUrl = `${siteConfig.url}${pagePath}`;

        // Replace or add OG image meta tags
        // Remove existing og:image, twitter:image, and og:url tags
        html = html.replace(/<meta[^>]*property="og:image"[^>]*>/gi, "");
        html = html.replace(/<meta[^>]*name="twitter:image"[^>]*>/gi, "");
        html = html.replace(/<meta[^>]*property="og:url"[^>]*>/gi, "");

        // Add new OG image tags before </head>
        const ogTags = `
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:secure_url" content="${imageUrl}">
  <meta property="og:site_name" content="${siteConfig.title}">
  <meta property="og:url" content="${pageUrl}">
  <meta name="twitter:image" content="${imageUrl}">
</head>`;

        html = html.replace(/<\/head>/i, ogTags);

        // Write back
        fs.writeFileSync(htmlFile, html, "utf-8");
        if (verbose) {
          console.log(`  ✓ Injected OG image: ${imageFilename}`);
        }
      }
    } catch (error) {
      console.log(
        `  ⊘ Error processing ${path.basename(htmlFile)}: ${error.message}`,
      );
    }

    // Progress update and GC hint every batch
    if (processed % BATCH_SIZE === 0) {
      if (verbose) {
        console.log(
          `  Progress: ${processed}/${htmlFiles.length} HTML files injected`,
        );
      }
      if (global.gc) global.gc();
    }
  }

  // Final progress update
  console.log(
    `  Progress: ${processed}/${htmlFiles.length} HTML files injected`,
  );
}

/**
 * Generate an OG image for a specific page
 */
async function generateOGImage({ title, description, slug, ogDir, card }) {
  try {
    const satoriRenderer = await initSatori();
    const width = 1200;
    const height = 630;

    // Truncate title if too long
    const maxTitleLength = 60;
    const displayTitle =
      title.length > maxTitleLength
        ? title.substring(0, maxTitleLength) + "..."
        : title;

    // Truncate description
    const maxDescLength = 120;
    const displayDesc =
      description && description.length > maxDescLength
        ? description.substring(0, maxDescLength) + "..."
        : description || "";

    // Create SVG using React-like JSX syntax
    // Use cached fonts (loaded once at plugin startup)
    const resolvedFonts = loadFontsOnce();

    const svg = await satoriRenderer(
      {
        type: "div",
        props: {
          style: {
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "space-between",
            backgroundColor: card.background,
            backgroundImage: card.backgroundImage,
            padding: 60,
            fontFamily: "Inter",
            position: "relative",
          },
          children: [
            // Decorative circles
            {
              type: "div",
              props: {
                style: {
                  position: "absolute",
                  top: -150,
                  right: -150,
                  width: 400,
                  height: 400,
                  borderRadius: "50%",
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                },
              },
            },
            {
              type: "div",
              props: {
                style: {
                  position: "absolute",
                  bottom: -100,
                  left: -100,
                  width: 300,
                  height: 300,
                  borderRadius: "50%",
                  backgroundColor: "rgba(255, 255, 255, 0.03)",
                },
              },
            },
            // Content
            {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: 40,
                },
                children: [
                  // Badge line — instance config, never a framework default
                  {
                    type: "div",
                    props: {
                      style: {
                        fontSize: 24,
                        fontWeight: "bold",
                        color: card.accent,
                      },
                      children: card.badge,
                    },
                  },
                  // Title
                  {
                    type: "div",
                    props: {
                      style: {
                        fontSize: 56,
                        fontWeight: "bold",
                        color: "#ffffff",
                        lineHeight: 1.2,
                        maxWidth: 1000,
                      },
                      children: displayTitle,
                    },
                  },
                  // Description
                  displayDesc && {
                    type: "div",
                    props: {
                      style: {
                        fontSize: 28,
                        color: "rgba(255, 255, 255, 0.7)",
                        lineHeight: 1.4,
                        maxWidth: 1000,
                      },
                      children: displayDesc,
                    },
                  },
                ].filter(Boolean),
              },
            },
            // Footer
            {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  paddingTop: 30,
                  borderTop: `4px solid ${card.accent}`,
                },
                children: [
                  {
                    type: "div",
                    props: {
                      style: {
                        fontSize: 28,
                        fontWeight: "bold",
                        color: card.accent,
                      },
                      children: card.footer,
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      {
        width,
        height,
        fonts: resolvedFonts,
      },
    );

    // Convert SVG to PNG using Sharp (write directly to file to avoid holding buffer in memory)
    const filename = slug.replace(/\//g, "-") + ".png";
    const filepath = path.join(ogDir, filename);
    await getSharp()(Buffer.from(svg)).png().toFile(filepath);

    if (verbose) {
      console.log(`  ✓ Generated: ${filename}`);
    }
    return filename;
  } catch (error) {
    console.error(
      `  ✗ Failed to generate image for "${title}":`,
      error.message,
    );
    return null;
  }
}
