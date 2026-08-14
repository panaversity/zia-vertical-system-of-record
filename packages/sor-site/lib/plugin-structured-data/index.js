/**
 * Docusaurus Plugin: Structured Data (JSON-LD) Injection
 *
 * Injects schema.org structured data into the built HTML during postBuild so
 * search engines and AI answer engines see it in the initial server response:
 *   - Homepage:   Organization + WebSite
 *   - Doc pages:  Article
 *
 * Copied from ag2 libs/docusaurus/plugin-structured-data at d764f334.
 * Changes on the way across the seam:
 * - the Organization (name, url, logo, sameAs) is plugin OPTIONS — branding is
 *   instance config, never a framework default; with no options the site's own
 *   title/url stand in;
 * - the schema.org type upstream emitted for a taught product is gone
 *   (product content, not machinery);
 * - the secondary-locale tree walk is gone (i18n is deferred wholesale
 *   post-v0; the default locale builds alone).
 *
 * Entity graph: Organization (@id .../#organization) and WebSite
 * (@id .../#website) are defined in full on the homepage and referenced by @id
 * from every Article (author / publisher / isPartOf). Each Article also inlines
 * the org/site name + logo so the page validates on its own, since Google's
 * rich-results parser evaluates each page independently.
 *
 * Dependency-free by design: parse and inject with plain string operations
 * (matching the sibling plugin-og-image), so no HTML-parser dependency is
 * needed.
 *
 * Usage in docusaurus.config.ts:
 * ```js
 * plugins: [
 *   [require('@vsor/lib-plugin-structured-data'), {
 *     organization: {
 *       name: "Example Org",
 *       url: "https://example.com",
 *       logo: "/img/logo.svg",           // site-relative or absolute
 *       sameAs: ["https://github.com/example"],
 *     },
 *   }],
 * ]
 * ```
 */

const fs = require("fs").promises;
const path = require("path");

const orgId = (url) => `${url}/#organization`;
const siteId = (url) => `${url}/#website`;

/**
 * The site's public root: origin joined with `baseUrl`, no trailing slash.
 *
 * Every URL and every `@id` in this file is built from it, and NOT from
 * `siteConfig.url` alone — found live 2026-08-14 against a GitHub Pages project
 * site (`url: "https://x.github.io"`, `baseUrl: "/mysite/"`), where the bare
 * origin made the homepage claim `@id "https://x.github.io/#website"` and a
 * search endpoint at `https://x.github.io/search` — an identity and an action
 * announced at a document root that belongs to somebody else's page. The
 * placeholder-url warning cannot catch this, because `url` is right; only the
 * join is missing.
 */
function publicRoot(siteConfig) {
  const origin = String(siteConfig.url || "").replace(/\/+$/, "");
  const base = String(siteConfig.baseUrl || "/").replace(/\/+$/, "");
  if (base === "") return origin;
  return `${origin}${base.startsWith("/") ? base : `/${base}`}`;
}

function resolveOrganization(siteConfig, options) {
  const org = options.organization || {};
  const siteUrl = publicRoot(siteConfig);
  // No default logo. The old fallback pointed every site at /img/logo.svg,
  // which this framework ships on no build — a structured-data node that names
  // a 404 is worse than one that omits an optional field (found live
  // 2026-08-14: the only image under build/img/ is favicon.svg).
  const logo = org.logo
    ? org.logo.startsWith("http")
      ? org.logo
      : `${siteUrl}${org.logo}`
    : undefined;
  return {
    name: org.name || siteConfig.title,
    url: org.url || siteUrl,
    logo,
    sameAs: Array.isArray(org.sameAs) ? org.sameAs : [],
  };
}

// Slim Organization reference: @id (for cross-page merge) plus the minimum
// fields that keep an individual page valid (name, url, and logo when one
// actually exists).
function organizationRef(url, org) {
  const ref = {
    "@type": "Organization",
    "@id": orgId(url),
    name: org.name,
    url: org.url,
  };
  if (org.logo) {
    ref.logo = { "@type": "ImageObject", url: org.logo };
  }
  return ref;
}

// Full Organization node (adds sameAs for entity disambiguation). Homepage only.
function organizationNode(url, org) {
  const node = organizationRef(url, org);
  if (org.sameAs.length > 0) {
    node.sameAs = org.sameAs;
  }
  return node;
}

function websiteRef(url, name) {
  return {
    "@type": "WebSite",
    "@id": siteId(url),
    name,
    url,
  };
}

module.exports = function structuredDataPlugin(context, options = {}) {
  const { siteConfig } = context;
  const org = resolveOrganization(siteConfig, options);

  return {
    name: "docusaurus-plugin-structured-data",

    async postBuild({ outDir }) {
      const rootIndex = path.join(outDir, "index.html");

      let homepageSuccess = false;
      let docsSuccess = false;

      // 1. Homepage: Organization + WebSite
      try {
        if (await fileExists(rootIndex)) {
          await injectHomepageSchemas(rootIndex, siteConfig, org);
          homepageSuccess = true;
        }
      } catch (error) {
        console.warn("⚠ Failed to inject homepage schemas:", error.message);
      }

      // 2. Article schema for every doc page
      try {
        await processDocsDirectory(
          path.join(outDir, "docs"),
          siteConfig,
          org,
          outDir,
        );
        docsSuccess = true;
      } catch (error) {
        console.warn("⚠ Failed to inject docs schemas:", error.message);
      }

      // Report results
      if (homepageSuccess && docsSuccess) {
        console.log(
          "✓ Structured data injected (Organization, WebSite, Article)",
        );
      } else if (homepageSuccess) {
        console.log("✓ Homepage schemas injected; docs processing had issues");
      } else if (docsSuccess) {
        console.log("✓ Docs Article schemas injected; homepage had issues");
      }
    },
  };
};

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function injectHomepageSchemas(filePath, siteConfig, org) {
  const html = await fs.readFile(filePath, "utf-8");

  const url = publicRoot(siteConfig);
  const title = siteConfig.title || "";
  const description = siteConfig.tagline || "";

  const organization = {
    "@context": "https://schema.org",
    ...organizationNode(url, org),
  };

  const website = {
    "@context": "https://schema.org",
    ...websiteRef(url, title),
    description,
    inLanguage: resolveInLanguage(siteConfig),
    publisher: { "@id": orgId(url) },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${url}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  const scripts =
    jsonLdScript("jsonld-organization", organization) +
    jsonLdScript("jsonld-website", website);

  await fs.writeFile(filePath, injectBeforeHead(html, scripts), "utf-8");
}

async function processDocsDirectory(dirPath, siteConfig, org, outDir) {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return; // Directory doesn't exist, skip
    throw error;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await processDocsDirectory(fullPath, siteConfig, org, outDir);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      await injectArticleSchema(fullPath, siteConfig, org, outDir);
    }
  }
}

async function injectArticleSchema(filePath, siteConfig, org, outDir) {
  try {
    const html = await fs.readFile(filePath, "utf-8");

    const url = publicRoot(siteConfig);
    const siteTitle = siteConfig.title || "";
    const rawTitle = extractTitle(html) || siteTitle;
    // The page's OWN description, and a fallback that says so. Silence here was
    // how the quotes defect survived: every page carried the tagline and the
    // build printed a green tick over it.
    const pageDescription = extractMetaContent(html, "description");
    if (!pageDescription) {
      console.warn(
        `⚠ ${path.basename(path.dirname(filePath))}: no <meta name="description"> in the built ` +
          "page — its Article node falls back to the site tagline.",
      );
    }
    const description = pageDescription || siteConfig.tagline || "";
    const canonical = extractCanonical(html);

    const articleData = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: cleanHeadline(rawTitle, siteTitle),
      description,
      image: await resolveArticleImage(canonical, url, outDir),
      inLanguage: resolveInLanguage(siteConfig),
      author: organizationRef(url, org),
      publisher: organizationRef(url, org),
      isPartOf: websiteRef(url, siteTitle),
      mainEntityOfPage: canonical
        ? { "@type": "WebPage", "@id": canonical }
        : undefined,
    };

    const html2 = injectBeforeHead(
      html,
      jsonLdScript("jsonld-article", articleData),
    );
    await fs.writeFile(filePath, html2, "utf-8");
  } catch (error) {
    // Log but don't throw - one file failing shouldn't stop others
    console.warn(`Warning: ${path.basename(filePath)}: ${error.message}`);
  }
}

// --- injection helpers (dependency-free) ---

// Serialize JSON-LD and neutralize "</script>" by escaping "<" as <
// (valid inside JSON strings), so a stray "<" in a description can never break
// out of the script tag.
function jsonLdScript(id, data) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/ld+json" id="${id}">${json}</script>`;
}

function injectBeforeHead(html, scripts) {
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, scripts + "</head>");
  }
  return html + scripts; // fallback: no </head> (shouldn't happen for a page)
}

// --- extraction helpers ---

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1].trim()) : "";
}

/**
 * Attribute values in BUILT html are only sometimes quoted, and that is the
 * whole reason these two functions exist in this shape.
 *
 * found live 2026-08-14, on a real `vsor build` (not a fixture): Docusaurus's
 * production minifier drops quotes from every value that needs none, so the page
 * carries `<meta data-rh=true name=description content="…">` and
 * `<link data-rh=true rel=canonical href=https://…/docs/example />`. The earlier
 * quotes-required patterns matched neither, silently, and the plugin then
 * reported success over wrong data: every doc page's Article node carried the
 * SITE TAGLINE as its description (identical on every page, while the page's own
 * `<meta name=description>` was correct and different), and `mainEntityOfPage`
 * was dropped entirely because the canonical never resolved.
 *
 * So: name matched with optional quotes and a delimiter lookahead (so `name=x`
 * cannot match `name=xy`), value matched in all three legal forms.
 */
const ATTR_VALUE = '(?:"([^"]*)"|\'([^\']*)\'|([^\\s"\'=<>`]+))';
const attrPattern = (name) => `\\b${name}\\s*=\\s*${ATTR_VALUE}`;
const namedAttr = (name, value) => `\\b${name}\\s*=\\s*["']?${value}["']?(?=[\\s>/])`;
// Three capture groups per value (double-quoted, single-quoted, bare); exactly
// one of them participates in any match.
const valueAt = (m, start) => m[start] ?? m[start + 1] ?? m[start + 2] ?? "";

function extractMetaContent(html, name) {
  const nameFirst = new RegExp(
    `<meta[^>]*${namedAttr("name", name)}[^>]*${attrPattern("content")}`,
    "i",
  );
  const contentFirst = new RegExp(
    `<meta[^>]*${attrPattern("content")}[^>]*${namedAttr("name", name)}`,
    "i",
  );
  const m = html.match(nameFirst) || html.match(contentFirst);
  return m ? decodeEntities(valueAt(m, 1)) : "";
}

function extractCanonical(html) {
  const relFirst = new RegExp(
    `<link[^>]*${namedAttr("rel", "canonical")}[^>]*${attrPattern("href")}`,
    "i",
  );
  const hrefFirst = new RegExp(
    `<link[^>]*${attrPattern("href")}[^>]*${namedAttr("rel", "canonical")}`,
    "i",
  );
  const m = html.match(relFirst) || html.match(hrefFirst);
  return m ? valueAt(m, 1) : "";
}

// Decode the HTML entities that appear in titles/descriptions. "&amp;" is
// decoded last so an already-escaped entity (e.g. "&amp;lt;") is not
// double-decoded.
function decodeEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// --- schema-shaping helpers ---

// Docusaurus titles render as "Page Title | Site Title". Strip the
// site-title suffix so the JSON-LD headline is the clean page title.
function cleanHeadline(title, siteTitle) {
  const suffix = ` | ${siteTitle}`;
  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}

function resolveInLanguage(siteConfig) {
  const i18n = siteConfig.i18n;
  return (i18n && i18n.defaultLocale) || "en";
}

// Compute the per-page OG image URL deterministically, matching the slug rule
// in @vsor/lib-plugin-og-image; pages without a generated card fall back to the
// static social card at img/og-image.jpg.
//
// Both candidates are then CHECKED AGAINST THE BUILD before being named. The
// og-image plugin does not ship in this framework's shell and no static social
// card is shipped either, so the unconditional fallback used to put a URL that
// 404s into every doc page's Article node (found live 2026-08-14). `image` is
// optional on Article; a missing field beats a broken one. Returns undefined
// when neither file was actually built, which JSON.stringify then drops.
async function resolveArticleImage(canonical, url, outDir) {
  const fallbackRel = "img/og-image.jpg";
  let rel = fallbackRel;
  if (canonical) {
    try {
      // Relative to the site's public root, not to the origin: under a subpath
      // deploy the canonical pathname opens with `/<repo>/`, which is not part
      // of any card's slug.
      const pathname = new URL(canonical).pathname;
      const basePath = new URL(`${url}/`).pathname;
      let slug = (
        pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname
      )
        .replace(/^\/+/, "")
        .replace(/\/+$/, "");
      if (slug.startsWith("docs/")) slug = slug.slice("docs/".length);
      if (slug) rel = `img/og/${slug.replace(/\//g, "-")}.png`;
    } catch {
      rel = fallbackRel;
    }
  }
  for (const candidate of rel === fallbackRel ? [rel] : [rel, fallbackRel]) {
    if (!outDir || (await fileExists(path.join(outDir, candidate)))) {
      if (!outDir) return undefined;
      return `${url}/${candidate}`;
    }
  }
  return undefined;
}
