/**
 * Types for the plugin entry, plus the public prop-type surface — re-exported
 * from lib/types, the module the A4 acceptance freezes as a baseline
 * (specs/sor-site/surface/spec.md).
 */

export default function sorSiteMdx(): {
  name: string;
  getThemePath: () => string;
  getTypeScriptThemePath: () => string;
};

export type {
  QuizProps,
  QuizQuestion,
  FlashcardsProps,
  FlashcardDeck,
  FlashcardCard,
  ConversationGalleryProps,
  GalleryYaml,
  GalleryData,
  GalleryConversation,
  GalleryScores,
  StudentField,
  ExerciseCardProps,
  HighlightTipProps,
} from "./lib/types";
