/**
 * RatingButtons — extracted from ag2/apps/learn-app/src/components/
 * flashcards/RatingButtons.tsx at d764f334.
 *
 * Strip against upstream: the ts-fsrs Rating enum (denylisted dependency) is
 * replaced by the local RecallRating type — Rating.Again -> "missed",
 * Rating.Good -> "gotit". Markup, keyboard handling ("1"/"2") and classes
 * are upstream's.
 */
import React, { useEffect, useState } from "react";
import type { RecallRating } from "./types";
import styles from "./Flashcards.module.css";

interface RatingButtonsProps {
  onRate: (rating: RecallRating) => void;
  missedCount: number;
  gotItCount: number;
  containerRef?: React.RefObject<HTMLDivElement>;
}

export default function RatingButtons({
  onRate,
  missedCount,
  gotItCount,
  containerRef,
}: RatingButtonsProps) {
  const [selected, setSelected] = useState<RecallRating | null>(null);

  const handleRateClick = (rating: RecallRating) => {
    setSelected(rating);
    // Give the React render cycle 1 tick to apply the CSS class before calling onRate
    // (which triggers the 250ms parent fade-out).
    setTimeout(() => onRate(rating), 10);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "1") {
        e.preventDefault();
        setSelected("missed");
        setTimeout(() => onRate("missed"), 10);
      } else if (e.key === "2") {
        e.preventDefault();
        setSelected("gotit");
        setTimeout(() => onRate("gotit"), 10);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onRate]);

  return (
    <div
      className={styles.ratingGroup}
      role="group"
      aria-label="Rate your recall"
      ref={containerRef}
      tabIndex={-1}
    >
      <span className={`${styles.trackerCount} ${styles.trackerMissed}`}>{missedCount}</span>
      <button
        className={`${styles.ratingButton} ${styles.ratingMissed} ${selected === "missed" ? styles.selected : ""}`}
        onClick={() => handleRateClick("missed")}
        aria-label="Missed it"
      >
        Missed It
      </button>
      <button
        className={`${styles.ratingButton} ${styles.ratingGotIt} ${selected === "gotit" ? styles.selected : ""}`}
        onClick={() => handleRateClick("gotit")}
        aria-label="Got it"
      >
        Got It
      </button>
      <span className={`${styles.trackerCount} ${styles.trackerGotIt}`}>{gotItCount}</span>
    </div>
  );
}
