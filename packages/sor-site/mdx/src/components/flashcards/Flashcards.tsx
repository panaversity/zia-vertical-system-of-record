/**
 * Flashcards — extracted from ag2/apps/learn-app/src/components/flashcards/
 * Flashcards.tsx at d764f334 (owner copy authorization 2026-08-13).
 *
 * Strips against upstream (surface spec negative contract):
 *   - ts-fsrs + useFSRS spaced-repetition scheduling and its localStorage
 *     persistence (ts-fsrs is denylisted; progress machinery stays behind).
 *     Rating is now a plain in-session "missed"/"gotit" mark; the deck-update
 *     reset toast went with the persistence.
 *   - progress-api XP submission, the XP panel, and the sign-in CTA
 *     (gamification and auth excluded)
 *   - the translator seed + static-label registry (i18n deferred post-v0)
 *   - the /guide#flashcards product-route link
 * Kept: browse/flip/rate flow, shuffle, keyboard navigation, CSV download,
 * session-complete stats, reduced-motion handling.
 *
 * FlashcardsProps is IDENTICAL to upstream — including that Flashcards
 * destructures only `cards` (tags/maxDifficulty/hideExport are accepted and
 * unused upstream, and stay that way here).
 */
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import type { FlashcardsProps, RecallRating } from "./types";
import FlashcardCard from "./FlashcardCard";
import RatingButtons from "./RatingButtons";
import styles from "./Flashcards.module.css";

export default function Flashcards({ cards: deck }: FlashcardsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ratedCards, setRatedCards] = useState<Map<string, RecallRating>>(
    new Map(),
  );

  // Root element of the widget. Used to scope keyboard navigation so the
  // global arrow/space handler only acts when the deck is the active
  // interaction context — otherwise an inline deck would swallow the
  // page's normal arrow-key scrolling on every page it appears on.
  const containerRef = useRef<HTMLDivElement>(null);

  // Close fullscreen on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFullscreen]);

  // Shuffle counter — increment to reshuffle (not a deterministic seed)
  const [shuffleCounter, setShuffleCounter] = useState(0);

  const shuffledIndices = useMemo(() => {
    if (!deck) return [];
    const indices = deck.cards.map((_, i) => i);
    if (shuffleCounter === 0) return indices;
    // Fisher-Yates shuffle
    const shuffled = [...indices];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [deck, shuffleCounter]);

  // Close download menu on outside click
  useEffect(() => {
    if (!showDownloadMenu) return;
    const close = () => setShowDownloadMenu(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showDownloadMenu]);

  const totalCards = deck?.cards.length ?? 0;
  const isLastCard = currentIndex >= totalCards - 1;

  const goToNext = useCallback(() => {
    if (isLastCard) return;
    setCurrentIndex((prev) => prev + 1);
    setIsFlipped(false);
  }, [isLastCard]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
    setIsFlipped(false);
  }, []);

  // Keyboard navigation (skip when user is typing in inputs/textareas)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // Only intercept arrows/space when the deck is the active interaction
      // context: fullscreen, or the widget actually holds keyboard focus.
      // Otherwise let the key fall through to the browser so the page scrolls.
      const el = containerRef.current;
      const isActive =
        isFullscreen || (!!el && el.contains(document.activeElement));
      if (!isActive) return;
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        // Only allow Space to flip front→back; rating buttons handle back→next
        setIsFlipped((prev) => (prev ? prev : true));
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goToNext();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goToPrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrev, isFullscreen]);

  const [isExiting, setIsExiting] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []);

  const handleRate = useCallback(
    (rating: RecallRating) => {
      if (!deck) return;
      const realIndex = shuffledIndices[currentIndex] ?? currentIndex;
      const card = deck.cards[realIndex];
      if (!card) return;

      setRatedCards((prev) => {
        const next = new Map(prev);
        next.set(card.id, rating);
        return next;
      });

      // Trigger exit animation
      setIsExiting(true);

      // Wait for CSS animation to finish before advancing
      exitTimerRef.current = setTimeout(() => {
        // Check if there are unrated cards — if so, navigate to the first one
        const updatedRated = new Map(ratedCards);
        updatedRated.set(card.id, rating);

        if (isLastCard && updatedRated.size < totalCards) {
          // Find first unrated card and navigate there
          const firstUnrated = deck!.cards.findIndex(
            (c) => !updatedRated.has(c.id),
          );
          if (firstUnrated !== -1) {
            // Map back through shuffled indices if shuffled
            const targetIndex = shuffledIndices.indexOf(firstUnrated);
            setCurrentIndex(targetIndex !== -1 ? targetIndex : firstUnrated);
          }
        } else if (!isLastCard) {
          setCurrentIndex((prev) => prev + 1);
        }
        setIsFlipped(false);
        setIsExiting(false);
      }, 250);
    },
    [deck, shuffledIndices, currentIndex, isLastCard, ratedCards, totalCards],
  );

  const handleShuffle = useCallback(() => {
    setShuffleCounter((prev) => prev + 1);
    setCurrentIndex(0);
    setIsFlipped(false);
  }, []);

  const handleDownloadCSV = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowDownloadMenu(false);

      if (!deck || !deck.cards) return;

      // Create a CSV string with a header row
      const headers = "Front,Back\n";
      const csvContent = deck.cards
        .map((card) => {
          // Escape quotes by doubling them, and wrap fields containing commas/newlines in quotes
          const escapeField = (text: string) => `"${text.replace(/"/g, '""')}"`;
          return `${escapeField(card.front)},${escapeField(card.back)}`;
        })
        .join("\n");

      const fullCsv = headers + csvContent;
      const blob = new Blob([fullCsv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `flashcards-${deck.deck.id}.csv`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    },
    [deck],
  );

  if (!deck) {
    return (
      <div className={styles.container}>
        <p className={styles.fallbackMessage}>
          Flashcards are not available for this page yet.
        </p>
      </div>
    );
  }

  // Derive counts from rated cards map (prevents double-counting on re-rating)
  const missedCount = [...ratedCards.values()].filter(
    (v) => v === "missed",
  ).length;
  const gotItCount = [...ratedCards.values()].filter(
    (v) => v === "gotit",
  ).length;

  // Session complete — every card rated and user has moved past the last card
  // (currentIndex stays on last card after rating, but isFlipped resets to false)
  const allRated = ratedCards.size >= totalCards;
  const sessionDone = allRated && isLastCard && !isFlipped;

  if (sessionDone) {
    const total = missedCount + gotItCount;
    const pct = total > 0 ? Math.round((gotItCount / total) * 100) : 0;
    return (
      <div
        ref={containerRef}
        className={`${styles.container} ${isFullscreen ? styles.fullscreen : ""}`}
      >
        {isFullscreen && (
          <button
            className={styles.closeButton}
            onClick={() => setIsFullscreen(false)}
            aria-label="Exit fullscreen"
          >
            ✕
          </button>
        )}
        <div className={styles.sessionComplete}>
          <div className={styles.sessionCompleteTitle}>Session Complete</div>
          <div className={styles.sessionStats}>
            <div className={`${styles.stat} ${styles.statMissed}`}>
              {missedCount} missed
            </div>
            <div className={`${styles.stat} ${styles.statGotIt}`}>
              {gotItCount} got it
            </div>
          </div>
          <div className={styles.sessionPct}>{pct}% correct</div>

          <button
            className={styles.exitButton}
            onClick={() => {
              setCurrentIndex(0);
              setIsFlipped(false);
              setRatedCards(new Map());
            }}
          >
            Review Again
          </button>
        </div>
      </div>
    );
  }

  const realIndex = shuffledIndices[currentIndex] ?? currentIndex;
  const currentCard = deck.cards[realIndex];
  const progress = totalCards > 0 ? ((currentIndex + 1) / totalCards) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${isFullscreen ? styles.fullscreen : ""}`}
    >
      {isFullscreen && (
        <button
          className={styles.closeButton}
          onClick={() => setIsFullscreen(false)}
          aria-label="Exit fullscreen"
        >
          ✕
        </button>
      )}
      <div className={styles.browseLayout}>
        <button
          className={styles.navArrow}
          onClick={goToPrev}
          disabled={currentIndex === 0}
          aria-label="Previous card"
        >
          ‹
        </button>

        <div className={`${styles.cardArea} ${styles.atmosphericGlow}`}>
          {currentCard && (
            <div
              className={`${styles.cardAnimator} ${isExiting ? styles.exiting : ""}`}
            >
              <FlashcardCard
                card={currentCard}
                isFlipped={isFlipped}
                onFlip={() => !isExiting && setIsFlipped((prev) => !prev)}
                cardNumber={currentIndex + 1}
                totalCards={totalCards}
              />
            </div>
          )}
        </div>

        <button
          className={styles.navArrow}
          onClick={goToNext}
          disabled={isLastCard}
          aria-label="Next card"
        >
          ›
        </button>
      </div>

      <div className={styles.ratingSlot} aria-hidden={!isFlipped}>
        {isFlipped && (
          <RatingButtons
            onRate={handleRate}
            missedCount={missedCount}
            gotItCount={gotItCount}
          />
        )}
      </div>

      <div className={styles.progressRow}>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={styles.cardCounter}>
          {currentIndex + 1} / {totalCards} cards
        </span>
      </div>

      <div className={styles.keyboardHints}>
        <span className={styles.keyHint}>
          <kbd>Space</kbd> flip
        </span>
        <span className={styles.keyHint}>
          <kbd>1</kbd> missed
        </span>
        <span className={styles.keyHint}>
          <kbd>2</kbd> got it
        </span>
        <span className={styles.keyHint}>
          <kbd>←→</kbd> navigate
        </span>
        <span className={styles.keyHint}>
          <kbd>Esc</kbd> exit
        </span>
      </div>

      <div className={styles.utilityRow}>
        <button
          className={styles.utilityButton}
          onClick={handleShuffle}
          aria-label="Shuffle cards"
        >
          ⇅ Shuffle
        </button>
        <div className={styles.downloadWrapper}>
          <button
            className={styles.utilityButton}
            onClick={(e) => {
              e.stopPropagation();
              setShowDownloadMenu((prev) => !prev);
            }}
            aria-label="Download flashcards"
            aria-expanded={showDownloadMenu}
          >
            ⤓ Download
          </button>
          {showDownloadMenu && (
            <div className={styles.downloadMenu}>
              <button
                className={styles.downloadOption}
                onClick={handleDownloadCSV}
              >
                Download CSV
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
