/**
 * DocItem/Content — wrap-only theme enhancement.
 *
 * Mounts the theme's doc-page layer around the stock content:
 * ReadingProgress (scroll indicator), a header row with DocPageActions,
 * and LessonContent (Full Text / Summary tabs when the summaries plugin
 * has a summary for this doc).
 *
 * Swizzle discipline (surface spec): wrap-only — the original content
 * implementation renders untouched via @theme-init (the enhancer alias, so
 * a site-level `swizzle --wrap DocItem/Content` still composes on top of
 * this). No themeConfig data is re-rendered here.
 *
 * Distilled from ag2 apps/learn-app src/theme/DocItem/Content at d764f334.
 * That wrapper was ~1,100 lines; everything else it mounted is excluded by
 * the surface spec's negative contract (the excluded identifiers are
 * deliberately not named here — the boundary test scans this source for
 * them): the tutor panel, teaching-guide sheet and study-mode floating
 * buttons (tutor & AI), the voice-reading dock, the completion button and
 * submission dialog (gamification), the practice-terminal overlay and its
 * context (practice & simulation), the feedback shipped-banner, the
 * account-completeness banner, the i18n banners and overlays (i18n
 * deferred wholesale), auth login redirects, and the zen-mode/reading-time
 * chrome (styled by upstream product CSS that is not carried).
 */

import React, { useEffect, useState } from "react";
import Content from "@theme-original/DocItem/Content";
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import { usePluginData } from "@docusaurus/useGlobalData";
import ReactMarkdown from "react-markdown";
import LessonContent from "@/components/LessonContent";
import DocPageActions from "@/components/DocPageActions";
import ReadingProgress from "@/components/ReadingProgress";
import styles from "./styles.module.css";

interface SummariesPluginData {
  summaries: Record<string, string>;
}

/**
 * Reading time — measured from the rendered document, never from frontmatter,
 * so it cannot go stale and a corpus author never maintains it.
 *
 * 200 wpm is the conventional silent-reading rate for expository prose. It is a
 * convention, not a measurement of this corpus; it is stated here rather than
 * buried so a domain with different reading speed knows exactly what to change.
 */
const WORDS_PER_MINUTE = 200;

const ClockIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

/**
 * Client-only: rendered as null on the server and on the first client render,
 * then filled in from the DOM. Counting words during SSR would need the raw MDX
 * (which this wrapper never sees) and any mismatch is a hydration error, which
 * the acceptance suite fails on (B11, zero console errors).
 */
function ReadingTime({ docId }: { docId: string }): React.ReactElement | null {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const body =
      document.querySelector<HTMLElement>("article .theme-doc-markdown") ??
      document.querySelector<HTMLElement>("article");
    const words = (body?.innerText ?? "").trim().split(/\s+/).filter(Boolean).length;
    setMinutes(words > 0 ? Math.max(1, Math.round(words / WORDS_PER_MINUTE)) : null);
  }, [docId]);

  if (minutes === null) return null;
  return (
    <span className={styles.readingTime}>
      <ClockIcon />
      {minutes} min read
    </span>
  );
}

export default function ContentWrapper(props: any): React.ReactElement {
  const doc = useDoc();

  // Summaries from global data — plugin optional, degrade gracefully.
  // (usePluginData throws when the plugin is absent; the call is
  // unconditional so the hook order stays stable.)
  let summaries: Record<string, string> = {};
  try {
    const pluginData = usePluginData("docusaurus-summaries-plugin") as
      | SummariesPluginData
      | undefined;
    summaries = pluginData?.summaries || {};
  } catch {
    summaries = {};
  }

  const summary = summaries[doc.metadata.id];
  const summaryElement = summary ? (
    <ReactMarkdown>{summary}</ReactMarkdown>
  ) : undefined;

  return (
    <>
      <ReadingProgress />
      <div className={styles.contentHeader}>
        <div className={styles.contentHeaderLeft}>
          <ReadingTime docId={doc.metadata.id} />
        </div>
        <DocPageActions />
      </div>
      <LessonContent summaryElement={summaryElement}>
        <Content {...props} />
      </LessonContent>
    </>
  );
}
