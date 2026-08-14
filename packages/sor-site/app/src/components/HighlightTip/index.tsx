/**
 * HighlightTip — a dismissible inline hint whose dismissal persists in
 * localStorage. Forked from ag2/apps/learn-app at d764f334.
 *
 * De-producted 2026-08-14. Upstream's copy read "Highlight text to **Ask**
 * questions" and its header described the tutor's highlight-to-ask affordance;
 * the tutor surface is excluded by the negative contract of
 * specs/sor-site/surface/spec.md, so the component was promising a feature no
 * vsor site has. The default text is now feature-neutral. Upstream had no
 * props and the component still takes none, so the A4 contract is unchanged.
 */

import React, { useState, useEffect } from "react";
import { X, Info } from "lucide-react";
import styles from "./HighlightTip.module.css";

const DISMISSED_KEY = "highlight_tip_dismissed";

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
      <Info className={styles.tipIcon} />
      <span className={styles.tipText}>
        Highlight text to <strong>select</strong> a passage
      </span>
      <button
        className={styles.dismissButton}
        onClick={handleDismiss}
        aria-label="Dismiss"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}

export default HighlightTip;
