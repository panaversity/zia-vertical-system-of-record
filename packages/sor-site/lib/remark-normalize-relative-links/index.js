/**
 * Remark plugin: resolve bare relative document links against the on-disk
 * corpus, honouring numbered folder prefixes.
 *
 * Copied from ag2 libs/docusaurus/remark-normalize-relative-links at d764f334.
 */
const fs = require("fs");
const path = require("path");

const PROTOCOL_RE = /^[a-zA-Z][a-zA-Z\d+.-]*:/;
const NUMBERED_PREFIX_RE = /^\d+[-_.]/;

function shouldResolve(url) {
  if (typeof url !== "string") return false;
  if (!url) return false;
  if (
    url.startsWith("/") ||
    url.startsWith("#") ||
    url.startsWith("../") ||
    url.startsWith("?") ||
    url.startsWith("<") ||
    url.startsWith("{") ||
    url.startsWith("www.") ||
    PROTOCOL_RE.test(url)
  ) {
    return false;
  }
  return true;
}

function splitUrl(url) {
  const match = url.match(/^([^?#]*)(.*)$/);
  return {
    pathname: match?.[1] || "",
    suffix: match?.[2] || "",
  };
}

function stripNumberedPrefix(name) {
  return name.replace(NUMBERED_PREFIX_RE, "");
}

function stripMarkdownExtension(name) {
  return name.replace(/\.mdx?$/i, "");
}

function slugForEntryName(name) {
  return stripMarkdownExtension(stripNumberedPrefix(name));
}

function findEntryForSegment(baseDir, segment, allowFile) {
  let entries;
  try {
    entries = fs.readdirSync(baseDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const direct = entries.find((entry) => entry.name === segment);
  if (direct) return direct.name;

  for (const entry of entries) {
    if (entry.isDirectory() && slugForEntryName(entry.name) === segment) {
      return entry.name;
    }
    if (
      allowFile &&
      entry.isFile() &&
      /\.(md|mdx)$/i.test(entry.name) &&
      (stripMarkdownExtension(entry.name) === segment ||
        slugForEntryName(entry.name) === segment)
    ) {
      return entry.name;
    }
  }

  return null;
}

function resolveRelativeDocPath(filePath, rawPathname) {
  if (!filePath || !rawPathname) return null;

  const pathname = rawPathname.startsWith("./")
    ? rawPathname.slice(2)
    : rawPathname;
  if (!pathname || pathname.startsWith(".")) return null;

  const parts = pathname.split("/").filter(Boolean);
  if (!parts.length) return null;

  let currentDir = path.dirname(filePath);
  const resolvedParts = [];

  for (let i = 0; i < parts.length; i++) {
    const segment = parts[i];
    const isLast = i === parts.length - 1;
    const entryName = findEntryForSegment(currentDir, segment, isLast);
    if (!entryName) return null;

    resolvedParts.push(entryName);
    currentDir = path.join(currentDir, entryName);
  }

  const lastPath = path.join(path.dirname(filePath), ...resolvedParts);
  try {
    if (fs.statSync(lastPath).isDirectory()) {
      for (const indexFile of ["README.md", "README.mdx", "index.md", "index.mdx"]) {
        if (fs.existsSync(path.join(lastPath, indexFile))) {
          resolvedParts.push(indexFile);
          break;
        }
      }
    }
  } catch {
    return null;
  }

  return `./${resolvedParts.join("/")}`;
}

function normalizeUrl(url, filePath) {
  if (!shouldResolve(url)) return url;

  const { pathname, suffix } = splitUrl(url);
  const resolved = resolveRelativeDocPath(filePath, pathname);
  return resolved ? `${resolved}${suffix}` : url;
}

function visitLinks(node, filePath) {
  if (!node || typeof node !== "object") return;
  if (node.type === "link") {
    node.url = normalizeUrl(node.url, filePath);
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      visitLinks(child, filePath);
    }
  }
}

function normalizeBareRelativeLinks() {
  return (tree, file) => {
    visitLinks(tree, file?.path);
  };
}

module.exports = normalizeBareRelativeLinks;
