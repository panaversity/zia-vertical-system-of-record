/**
 * Effective dating and supersession, rendered — the half a reader can see.
 *
 * The framework's own design test says provenance is not correctness: everything else
 * here proves who said something and when, and none of it expresses that a document has
 * been overtaken. A citation cannot catch that failure and an abstention gate cannot
 * either, because the corpus really does cover the question — it covers it with an answer
 * that expired. So the document says so itself, in three optional frontmatter keys:
 *
 *   effective: 2024-01-01          the day this document's content took effect
 *   superseded: true               this document is no longer current
 *   superseded_by: rules/new.md    what replaced it, as a path under knowledge/
 *
 * Two rules decide what this file does with them:
 *
 *   - **A superseded document says so ABOVE its content.** Not in a footer, not in a
 *     sidebar badge: the first thing on the page, before the first sentence a reader can
 *     quote. A notice below the text is a notice that arrives after the damage.
 *   - **A date is shown exactly as it was written.** No locale formatting anywhere —
 *     `toLocaleDateString` renders differently on the build machine and in the reader's
 *     browser, and the resulting hydration mismatch is a console error the acceptance
 *     suite fails on (B11). YYYY-MM-DD is also the one form that reads the same in every
 *     country, which is the same reason the build accepts only that form.
 *
 * The successor's URL is resolved through the docs plugin's own global data rather than
 * computed from the path, so a `slug:` override, a `baseUrl` and a routeBasePath are all
 * honoured by the thing that owns them. Resolution failure renders the notice WITHOUT a
 * link rather than throwing (`useLayoutDoc` would throw): `vsor build` refuses a pointer
 * that names no document, but `vsor dev` deliberately does not — marking a document
 * superseded before writing its successor is an ordinary state to be in mid-edit.
 *
 * `data-vsor-superseded` and `data-vsor-effective` are a deliberate contract rather than
 * test plumbing. The CSS-module class names beside them are content-hashed and change with
 * the stylesheet; these do not, so an owner restyling the notice from their own
 * `site/src/css/custom.css`, or a script auditing which pages carry a date, has something
 * stable to select. The browser tier selects on them for the same reason.
 */

import React from "react";
import Link from "@docusaurus/Link";
import { useAllDocsData, useDocsVersion } from "@docusaurus/plugin-content-docs/client";
import styles from "./EffectiveDating.module.css";

/** Frontmatter as the MDX module exports it — values are whatever YAML produced. */
type FrontMatter = Record<string, unknown>;

const MARKDOWN_SUFFIX = /\.mdx?$/i;

/**
 * The authored day, or null.
 *
 * Both shapes are accepted because a corpus author should never have to know which one
 * they wrote. An unquoted `2024-01-01` is a YAML timestamp, which Docusaurus's loader
 * serializes into the page as a real `Date`; a quoted one stays a string. `toISOString`
 * is UTC — deliberately, since that is the instant js-yaml parsed the bare day as, and a
 * local-time conversion would render the previous day west of Greenwich.
 */
export function authoredDay(value: unknown): string | null {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (typeof value === "string") {
    const match = /^(\d{4}-\d{2}-\d{2})$/.exec(value.trim());
    return match ? match[1] : null;
  }
  return null;
}

/** Whether the frontmatter says this document is no longer current. */
export function isSuperseded(frontMatter: FrontMatter): boolean {
  return frontMatter.superseded === true || typeof frontMatter.superseded_by === "string";
}

const CalendarIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

const ArchiveIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 8v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" />
    <rect x="1" y="3" width="22" height="5" rx="1" />
    <path d="M10 12h4" />
  </svg>
);

/**
 * "Effective <day>" — the document's own statement of when its content started applying.
 *
 * Rendered in the doc header beside the reading time, and rendered on a superseded
 * document too: the day it took effect stays true after it stops being current, and it is
 * the fact that lets a reader decide whether this page answers a question about 2023.
 */
export function EffectiveDate({ frontMatter }: { frontMatter: FrontMatter }): React.ReactElement | null {
  const day = authoredDay(frontMatter.effective);
  if (day === null) return null;
  return (
    <span className={styles.effective} data-vsor-effective={day}>
      <CalendarIcon />
      Effective <time dateTime={day}>{day}</time>
    </span>
  );
}

/**
 * The successor's URL and title, resolved through the docs plugin's own data.
 *
 * Both sides of the comparison are NFC-normalized, which is not pedantry: on macOS a
 * filename is stored exactly as it was typed, so `café.md` saved decomposed gives a doc id
 * carrying `e` + combining acute while the pointer in another document's frontmatter is
 * very often the precomposed form (or the reverse). The two render identically and compare
 * unequal, and the page then told the reader a replacement existed and named none — with
 * the file sitting right there in the corpus. `vsor build` normalizes the same way, so the
 * gate and the page agree about which document a pointer means.
 */
function useSuccessor(value: unknown): { permalink: string; label: string } | null {
  const allDocsData = useAllDocsData();
  const version = useDocsVersion();
  if (typeof value !== "string" || value.trim() === "") return null;

  const target = value.trim();
  const id = target.replace(MARKDOWN_SUFFIX, "").normalize("NFC");
  for (const data of Object.values(allDocsData))
    for (const candidate of data.versions)
      for (const doc of candidate.docs)
        if (doc.id.normalize("NFC") === id)
          return { permalink: doc.path, label: version.docs[doc.id]?.title ?? target };
  return null;
}

/**
 * The supersession notice — the first thing on a document that is no longer current.
 *
 * `role="alert"` is deliberately not used: this is a standing property of the page, not
 * something that just happened, and an alert role would interrupt a screen reader
 * mid-sentence on every navigation. A labelled `aside` puts it in the landmark list where
 * a reader can find it, and the visible heading carries the same words.
 */
export function SupersededNotice({ frontMatter }: { frontMatter: FrontMatter }): React.ReactElement | null {
  const successor = useSuccessor(frontMatter.superseded_by);
  if (!isSuperseded(frontMatter)) return null;
  return (
    <aside className={styles.superseded} aria-label="Supersession notice" data-vsor-superseded="true">
      <span className={styles.supersededIcon}>
        <ArchiveIcon />
      </span>
      <div className={styles.supersededBody}>
        <strong className={styles.supersededTitle}>Superseded</strong>
        <p className={styles.supersededText}>
          {successor ? (
            <>
              This document is no longer current. It was replaced by{" "}
              <Link to={successor.permalink} className={styles.supersededLink}>
                {successor.label}
              </Link>
              .
            </>
          ) : (
            <>This document is no longer current. No replacement is named.</>
          )}
        </p>
      </div>
    </aside>
  );
}
