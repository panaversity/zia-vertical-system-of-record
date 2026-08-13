/**
 * HighlightTip — extracted from ag2/apps/learn-app/src/components/
 * HighlightTip/index.tsx at d764f334: a dismissible inline hint whose
 * dismissal persists in localStorage.
 *
 * Strips against upstream:
 *   - lucide-react icons (not on the surface spec's dependency allowlist)
 *     replaced with equivalent inline SVGs — no dependency, no request
 *   - the default copy's bold "Ask" referred to the upstream tutor's
 *     highlight-to-ask feature (tutor surface excluded); the default text is
 *     now feature-neutral and upstream had no props, so the component stays
 *     prop-less (the A4 contract is unchanged)
 */
import React, { useState, useEffect } from "react";
import styles from "./HighlightTip.module.css";

const DISMISSED_KEY = "highlight_tip_dismissed";

export interface HighlightTipProps {}

export function HighlightTip() {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const dismissed = localStorage.getItem(DISMISSED_KEY);
      setIsDismissed(dismissed === "true");
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(DISMISSED_KEY, "true");
    }
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div className={styles.highlightTip}>
      <svg
        className={styles.tipIcon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      <span className={styles.tipText}>
        Highlight text to <strong>select</strong> a passage
      </span>
      <button
        className={styles.dismissButton}
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <svg
          className={styles.dismissIcon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );
}

export default HighlightTip;
