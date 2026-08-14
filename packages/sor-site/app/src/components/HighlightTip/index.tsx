/**
 * HighlightTip Component
 *
 * Subtle inline hint to educate users about highlight-to-ask.
 * Uses brand blue, minimal footprint, dismissible.
 * Shows for ALL users (Ask button now works for everyone).
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
        Highlight text to <strong>Ask</strong> questions
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
