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
 * account-completeness banner, translation/i18n banners and overlays (i18n
 * deferred wholesale), auth login redirects, and the zen-mode/reading-time
 * chrome (styled by upstream product CSS that is not carried).
 */

import React from "react";
import Content from "@theme-init/DocItem/Content";
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import { usePluginData } from "@docusaurus/useGlobalData";
import ReactMarkdown from "react-markdown";
import LessonContent from "@theme/LessonContent";
import DocPageActions from "@theme/DocPageActions";
import ReadingProgress from "@theme/ReadingProgress";
import styles from "./styles.module.css";

interface SummariesPluginData {
  summaries: Record<string, string>;
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
        <DocPageActions />
      </div>
      <LessonContent summaryElement={summaryElement}>
        <Content {...props} />
      </LessonContent>
    </>
  );
}
