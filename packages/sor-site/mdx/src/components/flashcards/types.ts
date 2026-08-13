/**
 * Flashcards types — extracted from ag2/apps/learn-app/src/components/
 * flashcards/types.ts at d764f334.
 *
 * Strips against upstream: PersistedDeckState / PersistedCardState are gone —
 * they described the ts-fsrs spaced-repetition state persisted to
 * localStorage, and ts-fsrs is on the surface spec's dependency denylist
 * (progress machinery stays behind). Rating here is a plain in-session recall
 * mark, not an SRS grade.
 *
 * The public props contract (FlashcardsProps and the deck/card shapes) is
 * IDENTICAL to upstream.
 */

/** YAML deck structure as authored in .flashcards.yaml files */
export interface FlashcardDeck {
  deck: {
    id: string;
    title: string;
    description: string;
    tags: string[];
    version: number;
  };
  cards: FlashcardCard[];
}

/** Single card from YAML */
export interface FlashcardCard {
  id: string;
  front: string;
  back: string;
  tags?: string[];
  difficulty?: "basic" | "intermediate" | "advanced";
  why?: string;
}

/** Props for the main Flashcards component */
export interface FlashcardsProps {
  /** Injected by remark plugin at build time. null = YAML not found. */
  cards?: FlashcardDeck | null;
  /** Filter by tags */
  tags?: string[];
  /** Filter by max difficulty */
  maxDifficulty?: "basic" | "intermediate" | "advanced";
  /** Hide Anki export button */
  hideExport?: boolean;
}

/**
 * In-session recall rating (replaces upstream's ts-fsrs Rating enum:
 * Rating.Again -> "missed", Rating.Good -> "gotit"). Internal, not part of
 * the MDX props contract.
 */
export type RecallRating = "missed" | "gotit";
