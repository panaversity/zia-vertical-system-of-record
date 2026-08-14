/**
 * The one public prop-type module of the RUNTIME SHELL — the surface the A4
 * acceptance freezes as a baseline (specs/sor-site/surface/spec.md: "exported
 * primitive prop types match the frozen baseline byte-for-byte"). Changing
 * anything re-exported here requires touching that spec.
 *
 * These are the primitives a corpus can actually write, i.e. exactly the
 * bespoke names src/theme/MDXComponents.tsx maps (Tabs/TabItem are stock
 * Docusaurus and carry Docusaurus's own contract, not ours; HighlightTip takes
 * no props, so it has no prop type to freeze).
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
