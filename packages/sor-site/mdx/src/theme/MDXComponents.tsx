/**
 * Maps the corpus vocabulary into @theme/MDXComponents on top of whatever the
 * active theme provides — this is what makes `<Quiz />` (and friends) render
 * on stock preset-classic with no other theme installed.
 *
 * Names must match what corpora and the remark pipeline use:
 *   - remark-flashcards injects `cards` into `<Flashcards />` elements
 *   - remark-gallery injects `gallery` into `<ConversationGallery />` elements
 *   - remark-tabs emits `<Tabs>`/`<TabItem>` elements without imports, so the
 *     stock theme-classic components are mapped here (upstream did the same
 *     for its tab plugins)
 * (Extracted from upstream src/theme/MDXComponents.tsx at d764f334; the
 * excluded vocabulary — gated/tutor/practice/marketing components — stays
 * behind per the surface spec's negative contract.)
 *
 * found live (2026-08-13): upstream wraps via @theme-original because it is a
 * SITE swizzle; from inside a theme package @theme-original resolves to this
 * very file (self-import → "Cannot access before initialization" at SSG).
 * @theme-init is the alias Docusaurus provides for a theme wrapping the base
 * implementation below it.
 */
import MDXComponents from "@theme-init/MDXComponents";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import Quiz from "../components/quiz/Quiz";
import LazyFlashcards from "../components/flashcards/LazyFlashcards";
import LazyConversationGallery from "../components/gallery/LazyConversationGallery";
import ExerciseCard from "../components/ExerciseCard";
import HighlightTip from "../components/HighlightTip";

export default {
  ...MDXComponents,
  Tabs,
  TabItem,
  Quiz,
  Flashcards: LazyFlashcards,
  ConversationGallery: LazyConversationGallery,
  ExerciseCard,
  HighlightTip,
};
