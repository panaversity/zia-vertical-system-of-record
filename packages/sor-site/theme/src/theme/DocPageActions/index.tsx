/**
 * DocPageActions — corpus-neutral page actions.
 *
 * Primary action: Copy Markdown (client-side HTML→Markdown via Turndown —
 * no API calls, offline-ready). Menu: Download Markdown, Download Section
 * (same-origin fetch of sibling pages via the chapter-manifest plugin's
 * global data), Share (Web Share API with clipboard fallback).
 *
 * Copied from ag2 apps/learn-app src/components/DocPageActions at d764f334.
 * Audited action-by-action against the surface spec's negative contract;
 * dropped on copy (see the extraction report for the named list — the
 * excluded identifiers are deliberately not written here because the
 * boundary test scans this source for them):
 *   - the two tutor-panel buttons ("Teach Me" / "Ask") and the study-mode
 *     context they opened (tutor & AI panels, excluded)
 *   - the feedback toolbar button, its dialogs, campaign/shipped nudges and
 *     their analytics tracking (feedback & admin + analytics, excluded;
 *     they called a product API endpoint read from site config)
 *   - the "Notes & Highlights" annotation-trial item (excluded)
 *   - the "Teaching Aid" sheet trigger (tutor, excluded)
 *   - "Ask ChatGPT" / "Ask Claude" (hardcoded third-party service URLs in
 *     theme source; the theme phones no one and names no vendors — also
 *     dragged the simple-icons dependency)
 *   - every sign-in gate and lock state (auth & gating excluded; section
 *     download is no longer sign-in gated)
 *   - the Radix/shadcn dropdown-menu + dialog primitives (tailwind UI kit;
 *     replaced by the self-contained accessible menu below so no
 *     radix/tailwind dependency crosses the seam)
 * De-branded: the section download header cites siteConfig.title, never a
 * product name; "lesson" vocabulary is gone from UI strings (the
 * chapter-manifest plugin's data keys keep their wire names).
 */

import React, { useEffect, useCallback, useRef, useState } from "react";
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import { usePluginData } from "@docusaurus/useGlobalData";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import TurndownService from "turndown";
import { useModKey } from "../useModKey";
import styles from "./styles.module.css";

// Concurrency limit for parallel same-origin fetching (section download)
const FETCH_CONCURRENCY = 4;

// ============================================================================
// ICONS — inline SVG only, no icon dependency
// ============================================================================

const CopyIcon = () => (
  <svg
    className={styles.icon}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = () => (
  <svg
    className={`${styles.icon} ${styles.iconSuccess}`}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const DownloadIcon = () => (
  <svg
    className={styles.icon}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    className={`${styles.icon} ${styles.chevronIcon}`}
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ShareIcon = () => (
  <svg
    className={styles.icon}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const BookIcon = () => (
  <svg
    className={styles.icon}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const LoadingIcon = () => (
  <svg
    className={`${styles.icon} ${styles.iconSpin}`}
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

// ============================================================================
// TYPES — wire contract of @vsor/lib-chapter-manifest-plugin (data keys keep
// their upstream names; only UI strings were de-domained)
// ============================================================================

interface ChapterLesson {
  id: string;
  normalizedId: string;
  title: string;
  slug: string;
  order: number;
}

interface Chapter {
  title: string;
  part: string;
  partPath: string;
  chapterPath: string;
  lessons: ChapterLesson[];
}

interface ChapterManifestData {
  chapters: Record<string, Chapter>;
  docToChapter: Record<string, string>;
}

// ============================================================================
// TURNDOWN SERVICE — Markdown extraction
// ============================================================================

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
  strongDelimiter: "**",
});

// Custom rule to preserve code blocks with language hints
turndownService.addRule("codeBlock", {
  filter: (node) => {
    return node.nodeName === "PRE" && node.querySelector("code") !== null;
  },
  replacement: (content, node) => {
    const codeElement = (node as HTMLElement).querySelector("code");
    if (!codeElement) return content;

    const className = codeElement.className || "";
    const langMatch = className.match(/language-(\w+)/);
    const lang = langMatch ? langMatch[1] : "";
    const code = codeElement.textContent || "";
    return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
  },
});

// UI elements stripped from extracted markdown (shared by both extractors)
const SELECTORS_TO_REMOVE = [
  ".theme-doc-footer",
  ".pagination-nav",
  ".doc-content-header",
  ".theme-code-block-copied-btn",
  ".docSidebarContainer",
  ".tocCollapsible",
  "button",
  ".admonition-icon",
  ".hash-link",
  // found live (2026-08-13, clipboard read after clicking Copy): both live
  // inside <article>, so without these the copied document opened with a
  // breadcrumb remnant (a bullet list with an empty link) followed by this
  // toolbar's own tooltip text ("Copy as Markdown⌘+⇧+C") before the content.
  ".theme-doc-breadcrumbs",
  '[data-vsor="doc-page-actions"]',
];

function articleToMarkdown(article: HTMLElement, title: string, sourceUrl: string): string {
  const clone = article.cloneNode(true) as HTMLElement;
  SELECTORS_TO_REMOVE.forEach((selector) => {
    clone.querySelectorAll(selector).forEach((el) => el.remove());
  });

  const hasH1 = clone.querySelector("h1");
  let markdown = "";
  if (!hasH1 && title) {
    markdown = `# ${title}\n\n`;
  }
  markdown += turndownService.turndown(clone.innerHTML);
  markdown += `\n\n---\nSource: ${sourceUrl}`;
  return markdown;
}

function downloadBlob(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================================
// TOOLTIP — simple hover tooltip
// ============================================================================

interface TooltipProps {
  content: string;
  shortcut?: string;
  children: React.ReactNode;
}

const Tooltip = ({ content, shortcut, children }: TooltipProps) => (
  <div className={styles.tooltipWrapper}>
    {children}
    <div className={styles.tooltip} role="tooltip">
      <span>{content}</span>
      {shortcut && <kbd className={styles.shortcut}>{shortcut}</kbd>}
    </div>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DocPageActions() {
  const doc = useDoc();
  const { siteConfig } = useDocusaurusContext();
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [sectionDownloading, setSectionDownloading] = useState(false);
  const [sectionDownloaded, setSectionDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Chapter manifest from global data — plugin optional, degrade gracefully.
  // (usePluginData throws when the plugin is absent; upstream wrapped it in
  // try/catch and the call order is unconditional, so the hook count is
  // stable across renders.)
  let chapterManifest: ChapterManifestData | null = null;
  try {
    chapterManifest = usePluginData(
      "docusaurus-chapter-manifest-plugin",
    ) as ChapterManifestData;
  } catch {
    // Plugin not wired — the section download item simply does not render.
  }

  const docId = doc.metadata.id;
  const chapterKey = chapterManifest?.docToChapter?.[docId];
  const currentSection = chapterKey
    ? chapterManifest?.chapters?.[chapterKey]
    : null;

  // Keyboard-shortcut modifier label — client-only state so SSR and the first
  // client render agree (see useModKey's found-live note on React #418).
  const modKey = useModKey();

  // ---- menu open/close behaviour (replaces the Radix dropdown) ----
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // Arrow-key navigation between menu items
  const onMenuKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? [],
    );
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === "ArrowDown"
        ? (current + 1) % items.length
        : (current - 1 + items.length) % items.length;
    items[next].focus();
  }, []);

  /**
   * Extract markdown from the rendered page content.
   * Client-side via Turndown — no external API, works offline.
   */
  const extractMarkdown = useCallback((): string => {
    const article = document.querySelector("article");
    if (!article) {
      return `# ${doc.metadata.title}\n\n${window.location.href}`;
    }
    return articleToMarkdown(article, doc.metadata.title, window.location.href);
  }, [doc.metadata.title]);

  // Copy markdown to clipboard
  const handleCopyMarkdown = useCallback(async () => {
    try {
      const markdown = extractMarkdown();
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn("Copy as Markdown failed, copying URL instead:", err);
      // Fallback: copy the page URL
      try {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // Silent fail — clipboard might not be available
      }
    }
  }, [extractMarkdown]);

  // Download markdown file
  const handleDownloadMarkdown = useCallback(() => {
    try {
      const markdown = extractMarkdown();
      const title =
        doc.metadata.title || doc.metadata.id.split("/").pop() || "document";
      downloadBlob(`${title.replace(/[^a-zA-Z0-9-_ ]/g, "")}.md`, markdown);
      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 2500);
    } catch (err) {
      console.warn("Download failed:", err);
    }
  }, [extractMarkdown, doc.metadata.title, doc.metadata.id]);

  // Share (Web Share API; clipboard fallback). Corpus-neutral: shares only
  // the page's own URL — the copy-link style the theme keeps.
  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: doc.metadata.title,
          url: window.location.href,
        });
      } catch {
        // User cancelled — silent
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // Silent fail
      }
    }
  }, [doc.metadata.title]);

  /**
   * Extract markdown from a same-origin URL (section download). Every fetch
   * targets this site's own pages — the theme initiates no off-origin request.
   */
  const extractMarkdownFromUrl = useCallback(
    async (url: string, title: string): Promise<string> => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${url}`);
        }
        const html = await response.text();
        const parsed = new DOMParser().parseFromString(html, "text/html");
        const article = parsed.querySelector("article");
        if (!article) {
          return `# ${title}\n\n*Content could not be extracted*\n\nSource: ${url}`;
        }
        return articleToMarkdown(article as HTMLElement, title, url);
      } catch (err) {
        console.warn(`Failed to extract markdown from ${url}:`, err);
        return `# ${title}\n\n*Content could not be extracted*\n\nSource: ${url}`;
      }
    },
    [],
  );

  /** Parallel fetch with concurrency limit */
  const fetchWithConcurrency = useCallback(
    async (
      items: ChapterLesson[],
      fetcher: (
        item: ChapterLesson,
        index: number,
      ) => Promise<{ index: number; result: string }>,
      onProgress: (completed: number, current: string) => void,
    ): Promise<Map<number, string>> => {
      const results = new Map<number, string>();
      let completedCount = 0;

      for (let i = 0; i < items.length; i += FETCH_CONCURRENCY) {
        const batch = items.slice(i, i + FETCH_CONCURRENCY);
        const batchResults = await Promise.all(
          batch.map((item, batchIndex) => fetcher(item, i + batchIndex)),
        );
        for (const { index, result } of batchResults) {
          results.set(index, result);
          completedCount++;
          onProgress(completedCount, items[index].title);
        }
      }

      return results;
    },
    [],
  );

  /**
   * Download the whole section as one consolidated Markdown file with a
   * table of contents. No sign-in gate (auth is excluded by contract).
   */
  const handleDownloadSection = useCallback(async () => {
    if (!currentSection) return;

    setSectionDownloading(true);
    setDownloadProgress("Preparing...");

    try {
      const baseUrl = window.location.origin;

      const pageResults = await fetchWithConcurrency(
        currentSection.lessons,
        async (page, index) => {
          const pageUrl = `${baseUrl}${page.slug}`;
          const markdown = await extractMarkdownFromUrl(pageUrl, page.title);
          return { index, result: markdown };
        },
        (completed, currentTitle) => {
          setDownloadProgress(
            `${currentTitle} (${completed}/${currentSection.lessons.length})`,
          );
        },
      );

      setDownloadProgress("Building document...");

      const toAnchor = (title: string): string =>
        title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-");

      const toc = currentSection.lessons
        .map(
          (page, i) => `${i + 1}. [${page.title}](#${toAnchor(page.title)})`,
        )
        .join("\n");

      // De-branded: attribution comes from the instance's site title.
      const sections: string[] = [
        `# ${currentSection.part}: ${currentSection.title}`,
        "",
        `> Downloaded from ${siteConfig.title} on ${new Date().toLocaleDateString()}`,
        `> Pages: ${currentSection.lessons.length}`,
        "",
        "## Table of Contents",
        "",
        toc,
        "",
        "---",
        "",
      ];

      currentSection.lessons.forEach((page, index) => {
        let markdown =
          pageResults.get(index) ||
          `# ${page.title}\n\n*Content could not be extracted*`;
        // Strip per-page source footers; one attribution goes at the end.
        markdown = markdown.replace(/\n\n---\nSource:.*$/, "");
        sections.push(markdown, "", "---", "");
      });

      sections.push(
        `Source: ${window.location.origin}/docs/${currentSection.partPath}/${currentSection.chapterPath}`,
      );

      const fileName = currentSection.title.replace(/[^a-zA-Z0-9-_ ]/g, "");
      downloadBlob(`${fileName}.md`, sections.join("\n"));

      setSectionDownloaded(true);
      setTimeout(() => setSectionDownloaded(false), 3000);
    } catch (err) {
      console.warn("Section download failed:", err);
      setDownloadProgress("Download failed");
      setTimeout(() => setDownloadProgress(""), 2000);
    } finally {
      setSectionDownloading(false);
      setDownloadProgress((p) => (p.includes("failed") ? p : ""));
    }
  }, [currentSection, siteConfig.title, extractMarkdownFromUrl, fetchWithConcurrency]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Shift + C — copy markdown
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "c"
      ) {
        e.preventDefault();
        handleCopyMarkdown();
      }
      // Ctrl/Cmd + Shift + D — download markdown
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "d"
      ) {
        e.preventDefault();
        handleDownloadMarkdown();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleCopyMarkdown, handleDownloadMarkdown]);

  const closeAnd = (fn: () => void | Promise<void>) => () => {
    setMenuOpen(false);
    void fn();
  };

  return (
    <div
      className={styles.root}
      role="toolbar"
      aria-label="Page actions"
      data-vsor="doc-page-actions"
    >
      {/* Split button: primary copy action + menu trigger */}
      <div
        className={`${styles.split} ${copied ? styles.splitSuccess : ""}`}
        ref={menuRef}
      >
        <Tooltip
          content={copied ? "Copied!" : "Copy as Markdown"}
          shortcut={copied ? undefined : `${modKey}+⇧+C`}
        >
          <button
            className={`${styles.main} ${copied ? styles.mainSuccess : ""}`}
            onClick={handleCopyMarkdown}
            aria-label={copied ? "Copied to clipboard" : "Copy page as Markdown"}
            aria-pressed={copied}
          >
            <span className={styles.iconWrapper}>
              {copied ? <CheckIcon /> : <CopyIcon />}
            </span>
          </button>
        </Tooltip>

        <button
          className={styles.chevron}
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          data-state={menuOpen ? "open" : "closed"}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <ChevronDownIcon />
        </button>

        {menuOpen && (
          <div
            className={styles.menu}
            role="menu"
            aria-label="Page actions menu"
            onKeyDown={onMenuKeyDown}
          >
            <button
              role="menuitem"
              className={`${styles.menuItem} ${downloaded ? styles.menuItemSuccess : ""}`}
              onClick={closeAnd(handleDownloadMarkdown)}
            >
              {downloaded ? <CheckIcon /> : <DownloadIcon />}
              <span>{downloaded ? "Downloaded!" : "Download Markdown"}</span>
              <kbd className={styles.menuShortcut}>{modKey}+⇧+D</kbd>
            </button>

            {currentSection && (
              <button
                role="menuitem"
                className={`${styles.menuItem} ${sectionDownloaded ? styles.menuItemSuccess : ""}`}
                onClick={() => void handleDownloadSection()}
                disabled={sectionDownloading}
              >
                {sectionDownloading ? (
                  <LoadingIcon />
                ) : sectionDownloaded ? (
                  <CheckIcon />
                ) : (
                  <BookIcon />
                )}
                <span className={styles.menuItemContent}>
                  <span className={styles.menuItemLabel}>
                    {sectionDownloading
                      ? downloadProgress
                      : sectionDownloaded
                        ? "Section downloaded!"
                        : "Download section"}
                  </span>
                  {!sectionDownloading && !sectionDownloaded && (
                    <span className={styles.menuItemMeta}>
                      ({currentSection.lessons.length} pages)
                    </span>
                  )}
                </span>
              </button>
            )}

            <div className={styles.menuSeparator} role="separator" />

            <button
              role="menuitem"
              className={styles.menuItem}
              onClick={closeAnd(handleShare)}
            >
              <ShareIcon />
              <span>Share</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default DocPageActions;
