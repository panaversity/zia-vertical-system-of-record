/**
 * The one public prop-type module — the surface the A4 acceptance freezes as
 * a baseline (specs/sor-site/surface/spec.md: "exported primitive prop types
 * match the frozen baseline byte-for-byte"). Changing anything re-exported
 * here requires touching that spec.
 *
 * Contracts are IDENTICAL to upstream at the pinned survey SHA (d764f334):
 * <Quiz /> normatively takes exactly four `options`, a `correctOption` index,
 * optional `explanation`/`source`.
 */

export type { QuizProps, QuizQuestion } from "./components/quiz/Quiz";
export type {
  FlashcardsProps,
  FlashcardDeck,
  FlashcardCard,
} from "./components/flashcards/types";
export type {
  ConversationGalleryProps,
  GalleryYaml,
  GalleryData,
  GalleryConversation,
  GalleryScores,
  StudentField,
} from "./components/gallery/types";
export type { ExerciseCardProps } from "./components/ExerciseCard";
export type { HighlightTipProps } from "./components/HighlightTip";
