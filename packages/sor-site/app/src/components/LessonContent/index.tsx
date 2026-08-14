/**
 * LessonContent — the doc-page primitive.
 *
 * A tabbed interface for doc content with Full Text and Summary views.
 * The Summary tab only appears when summaryElement is provided; otherwise
 * children render untouched. Wrapped around doc content by this theme's
 * DocItem/Content enhancement.
 *
 * Copied from ag2 apps/learn-app src/components/LessonContent at d764f334.
 * Stripped on copy (surface spec negative contract): the auth hook and the
 * content-gate wrapper (auth & gating excluded — summary is never locked
 * here; real visibility is open decision B4, and browser gating is theater
 * anyway), and the highlight-tip hint for the tutor "Ask" affordance (that
 * component ships in the MDX vocabulary package, not mounted here). Labels
 * are props so no curriculum vocabulary ships as a default ("Full Lesson"
 * upstream -> "Full Text" default here).
 */

import React, { useState, useRef, useCallback } from "react";
import styles from "./styles.module.css";

interface LessonContentProps {
  children: React.ReactNode;
  summaryElement?: React.ReactNode;
  /** Label for the full-content tab. Instance copy, not framework branding. */
  fullLabel?: string;
  /** Label for the summary tab. */
  summaryLabel?: string;
}

/** Document icon — full content view. */
const DocumentIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="18"
    height="18"
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
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

/** Summary icon — condensed view. */
const SummaryIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="21" y1="10" x2="3" y2="10" />
    <line x1="21" y1="6" x2="3" y2="6" />
    <line x1="21" y1="14" x2="3" y2="14" />
    <line x1="21" y1="18" x2="3" y2="18" />
  </svg>
);

export const LessonContent: React.FC<LessonContentProps> = ({
  children,
  summaryElement,
  fullLabel = "Full Text",
  summaryLabel = "Summary",
}) => {
  const [activeTab, setActiveTab] = useState<"full" | "summary">("full");
  const contentRef = useRef<HTMLDivElement>(null);

  const handleTabChange = useCallback((tab: "full" | "summary") => {
    setActiveTab(tab);
    // Smooth scroll to top of content when switching tabs
    contentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // If no summary available, just render children without tabs
  if (!summaryElement) {
    return <>{children}</>;
  }

  return (
    <div className={styles.lessonContent} ref={contentRef}>
      {/* Tab Navigation */}
      <nav className={styles.tabNav} role="tablist" aria-label="Content view">
        <button
          role="tab"
          aria-selected={activeTab === "full"}
          aria-controls="panel-full"
          id="tab-full"
          tabIndex={activeTab === "full" ? 0 : -1}
          className={`${styles.tab} ${activeTab === "full" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("full")}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") {
              handleTabChange("summary");
              document.getElementById("tab-summary")?.focus();
            }
          }}
        >
          <span className={styles.tabIcon}>
            <DocumentIcon />
          </span>
          <span className={styles.tabLabel}>{fullLabel}</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === "summary"}
          aria-controls="panel-summary"
          id="tab-summary"
          tabIndex={activeTab === "summary" ? 0 : -1}
          className={`${styles.tab} ${activeTab === "summary" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("summary")}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              handleTabChange("full");
              document.getElementById("tab-full")?.focus();
            }
          }}
        >
          <span className={styles.tabIcon}>
            <SummaryIcon />
          </span>
          <span className={styles.tabLabel}>{summaryLabel}</span>
        </button>
      </nav>

      {/* Content Panels */}
      <div className={styles.panelContainer}>
        {/* Full Content Panel */}
        <div
          role="tabpanel"
          id="panel-full"
          aria-labelledby="tab-full"
          className={`${styles.panel} ${activeTab === "full" ? styles.panelActive : ""}`}
          hidden={activeTab !== "full"}
        >
          {children}
        </div>

        {/* Summary Panel — never gated (auth/gating excluded by contract) */}
        <div
          role="tabpanel"
          id="panel-summary"
          aria-labelledby="tab-summary"
          className={`${styles.panel} ${activeTab === "summary" ? styles.panelActive : ""}`}
          hidden={activeTab !== "summary"}
        >
          <div className={styles.summaryContent}>
            <div className={styles.summaryBody}>{summaryElement}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LessonContent;
