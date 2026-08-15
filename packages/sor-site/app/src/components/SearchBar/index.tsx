/**
 * SearchBar — command-palette search over the LOCAL index. No external
 * service, ever (surface spec: search stays the local index).
 *
 * Provided as @theme/SearchBar so the stock classic navbar picks it up
 * natively; when @easyops-cn/docusaurus-search-local is also installed
 * (it generates the index this reads), list THIS theme after it so this
 * SearchBar shadows that one.
 *
 * Copied from ag2 apps/learn-app src/components/SearchBar at d764f334.
 * Stripped/reworked on copy:
 *   - the mobile gamification-ranking link (excluded by contract)
 *   - the shadcn/cmdk command dialog, button kit and lucide icons
 *     (tailwind UI kit; replaced by the self-contained dialog below so no
 *     cmdk/radix/lucide dependency crosses the seam)
 *   - "Search Book..." copy de-branded to corpus-neutral "Search…"
 *   - results render as real links (Docusaurus <Link>), so "a result links
 *     to that doc" is literally true in the DOM (B13)
 * Kept: ⌘K/Ctrl+K shortcut, 300ms debounce, 8-result cap, empty/loading/
 * no-result states, the search-utils scoring engine.
 */

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useHistory } from "@docusaurus/router";
import Link from "@docusaurus/Link";
import { searchContent, type SearchResult } from "./search-utils";
import { useModKey } from "@/lib/useModKey";
import styles from "./styles.module.css";

const SearchIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
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
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const FileIcon = () => (
  <svg
    className={styles.resultIcon}
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
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14,2 14,8 20,8" />
  </svg>
);

const SpinnerIcon = () => (
  <svg
    className={`${styles.stateIcon} ${styles.spin}`}
    width="32"
    height="32"
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

export function SearchBar({
  enableShortcut = true,
  compact = false,
}: {
  enableShortcut?: boolean;
  /**
   * Icon-only trigger for the navbar's right cluster. The full-width field
   * reads as web-app chrome in a masthead; the modal it opens is identical.
   */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const history = useHistory();

  // Client-only state so SSR and the first client render agree — the old
  // module-level navigator.platform check baked the BUILD HOST's OS into the
  // shipped HTML (see useModKey's found-live note on React #418).
  const shortcutKey = useModKey();

  // Toggle with Cmd+K / Ctrl+K
  useEffect(() => {
    if (!enableShortcut) return;
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [enableShortcut]);

  // Focus input when opened; clear state when closed
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else {
      setQuery("");
      setResults([]);
      setSelected(0);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Search (debounced)
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const searchResults = await searchContent(query);
        setResults(searchResults.slice(0, 8));
        setSelected(0);
      } catch (error) {
        console.warn("Search failed:", error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const close = () => setOpen(false);

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && results[selected]) {
      e.preventDefault();
      close();
      history.push(results[selected].url);
    }
  };

  const showEmptyHint = !query.trim();
  const showLoading = loading && !!query.trim();
  const showNoResults = !loading && !!query.trim() && results.length === 0;
  const showResults = !loading && results.length > 0;

  return (
    <>
      <button
        type="button"
        className={compact ? styles.triggerCompact : styles.trigger}
        onClick={() => setOpen(true)}
        aria-label="Search"
        title={compact ? `Search (${shortcutKey}K)` : undefined}
        data-vsor="search-button"
      >
        <SearchIcon className={styles.triggerIcon} />
        {!compact && (
          <>
            <span className={styles.triggerLabel}>Search…</span>
            <kbd className={styles.triggerKbd} aria-hidden="true">
              {shortcutKey}K
            </kbd>
          </>
        )}
      </button>

      {/* Portalled to <body> deliberately. The navbar this renders inside is
          `sticky` with `backdrop-blur-xl`, and a non-none backdrop-filter makes
          an element the containing block for its `position: fixed` descendants
          — so rendered in place, this overlay resolved against the 1193×64
          navbar instead of the viewport: the backdrop dimmed only the navbar
          strip and the dialog hung off-centre at the top of the page.
          found live 2026-08-15 on the deployed demo. `open` is false until a
          browser event sets it, so this never runs during SSR. */}
      {open && createPortal(
        <div
          className={styles.overlay}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-label="Search"
          >
            <div className={styles.inputRow}>
              <SearchIcon className={styles.inputIcon} />
              <input
                ref={inputRef}
                className={styles.input}
                type="search"
                placeholder="Search documentation…"
                aria-label="Search query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                data-vsor="search-input"
              />
            </div>

            <div className={styles.body}>
              {showEmptyHint && (
                <div className={styles.state}>
                  <SearchIcon className={styles.stateIcon} />
                  <p className={styles.stateText}>Type to search</p>
                  <p className={styles.stateHint}>
                    Press{" "}
                    <kbd className={styles.hintKbd}>{shortcutKey}+K</kbd>{" "}
                    anytime to open
                  </p>
                </div>
              )}

              {showLoading && (
                <div className={styles.state}>
                  <SpinnerIcon />
                  <p className={styles.stateText}>Searching…</p>
                </div>
              )}

              {showNoResults && (
                <div className={styles.state} data-vsor="search-no-results">
                  <p className={styles.stateText}>
                    No results found for &ldquo;{query}&rdquo;
                  </p>
                </div>
              )}

              {showResults && (
                <ul
                  className={styles.results}
                  role="listbox"
                  aria-label="Search results"
                  data-vsor="search-results"
                >
                  {results.map((result, index) => (
                    <li
                      key={`${result.url}-${index}`}
                      role="option"
                      aria-selected={index === selected}
                    >
                      <Link
                        to={result.url}
                        className={`${styles.result} ${
                          index === selected ? styles.resultSelected : ""
                        }`}
                        onClick={close}
                        onMouseEnter={() => setSelected(index)}
                      >
                        <FileIcon />
                        <span className={styles.resultText}>
                          <span className={styles.resultTitle}>
                            {result.title}
                          </span>
                          {result.text && (
                            <span className={styles.resultMeta}>
                              {result.text}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export default SearchBar;
