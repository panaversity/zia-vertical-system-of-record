/**
 * FlashcardCard — extracted from ag2/apps/learn-app/src/components/
 * flashcards/FlashcardCard.tsx at d764f334, unchanged apart from imports:
 * the file carried no excluded behavior (no auth, no progress, no analytics).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import type { FlashcardCard as FlashcardCardType } from "./types";
import styles from "./Flashcards.module.css";

interface FlashcardCardProps {
  card: FlashcardCardType;
  isFlipped: boolean;
  onFlip: () => void;
  cardNumber: number;
  totalCards: number;
}

type VisibleSide = "front" | "back";
type FlipDirection = "forward" | "backward" | null;

const FLIP_DURATION_MS = 580;
const FLIP_MIDPOINT_MS = 270;

type ContentPhase = "steady" | "settling";

export default function FlashcardCard({
  card,
  isFlipped,
  onFlip,
  cardNumber,
  totalCards,
}: FlashcardCardProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [hasFlippedOnce, setHasFlippedOnce] = useState(false);
  const [copied, setCopied] = useState(false);
  const [visibleSide, setVisibleSide] = useState<VisibleSide>(
    isFlipped ? "back" : "front",
  );
  const [shellTurned, setShellTurned] = useState(isFlipped);
  const [flipDirection, setFlipDirection] = useState<FlipDirection>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [contentPhase, setContentPhase] = useState<ContentPhase>("steady");
  const hasMountedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const clearFlipTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) =>
      setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Reset hasFlippedOnce when card changes
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    setHasFlippedOnce(false);
    setVisibleSide("front");
    setShellTurned(false);
    setFlipDirection(null);
    setIsAnimating(false);
    setContentPhase("steady");
    clearFlipTimers();
    setCopied(false);
  }, [card.id, clearFlipTimers]);

  useEffect(() => {
    return () => clearFlipTimers();
  }, [clearFlipTimers]);

  useEffect(() => {
    const targetSide: VisibleSide = isFlipped ? "back" : "front";

    if (prefersReducedMotion) {
      clearFlipTimers();
      setVisibleSide(targetSide);
      setShellTurned(isFlipped);
      setFlipDirection(null);
      setIsAnimating(false);
      setContentPhase("steady");
      return;
    }

    if (isAnimating) {
      return;
    }

    if (shellTurned === isFlipped && visibleSide === targetSide) {
      return;
    }

    clearFlipTimers();
    setIsAnimating(true);
    setFlipDirection(isFlipped ? "forward" : "backward");
    setShellTurned(isFlipped);
    setContentPhase("steady");

    const midpointTimer = window.setTimeout(() => {
      setVisibleSide(targetSide);
      setContentPhase("settling");
    }, FLIP_MIDPOINT_MS);

    const settleTimer = window.setTimeout(() => {
      setIsAnimating(false);
      setFlipDirection(null);
      setContentPhase("steady");
    }, FLIP_DURATION_MS);

    timersRef.current = [midpointTimer, settleTimer];
  }, [
    isFlipped,
    prefersReducedMotion,
    clearFlipTimers,
    visibleSide,
    shellTurned,
    isAnimating,
  ]);

  // Track first flip
  useEffect(() => {
    if (isFlipped && !hasFlippedOnce) {
      setHasFlippedOnce(true);
    }
  }, [isFlipped, hasFlippedOnce]);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const text = visibleSide === "back" ? card.back : card.front;
      navigator.clipboard.writeText(text).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        },
        () => {
          // Clipboard unavailable (insecure context or permission denied)
        },
      );
    },
    [visibleSide, card.front, card.back],
  );

  const activeText = visibleSide === "back" ? card.back : card.front;
  const cardClasses = [
    styles.card,
    visibleSide === "back" ? styles.cardRevealed : "",
    isAnimating ? styles.cardAnimating : "",
  ]
    .filter(Boolean)
    .join(" ");
  const cardShellClasses = [
    styles.cardShell,
    shellTurned ? styles.cardShellTurned : "",
    flipDirection === "forward" ? styles.cardShellForward : "",
    flipDirection === "backward" ? styles.cardShellBackward : "",
  ]
    .filter(Boolean)
    .join(" ");
  const cardFaceClasses = [
    styles.cardFace,
    visibleSide === "back" ? styles.cardBackFace : styles.cardFrontFace,
    contentPhase === "settling" ? styles.contentSettling : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={styles.cardWrapper}>
      <div
        className={cardClasses}
        onClick={() => {
          if (!isAnimating) {
            onFlip();
          }
        }}
        onKeyDown={(e) => {
          if (isAnimating) {
            return;
          }
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onFlip();
          }
        }}
        role="region"
        aria-label={`Flashcard ${cardNumber} of ${totalCards}${visibleSide === "back" ? ", answer" : ", question"}`}
        aria-live="polite"
        tabIndex={0}
      >
        <div className={cardShellClasses}>
          <div key={`${card.id}-${visibleSide}`} className={cardFaceClasses}>
            <button
              className={styles.copyButton}
              onClick={handleCopy}
              aria-label="Copy card text"
              title="Copy to clipboard"
            >
              {copied ? "✓" : "⎘"}
            </button>
            <div className={styles.cardContent}>
              <div className={styles.safeCenter}>
                <Markdown>{activeText}</Markdown>
              </div>
            </div>
            {visibleSide === "front" && !hasFlippedOnce && (
              <div className={styles.seeAnswerHint}>Click to flip</div>
            )}
            {visibleSide === "back" && card.why && (
              <div className={styles.whySection}>
                <div className={styles.whyLabel}>Why?</div>
                <Markdown>{card.why}</Markdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
