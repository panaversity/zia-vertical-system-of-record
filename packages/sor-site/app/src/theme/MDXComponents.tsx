/**
 * The MDX vocabulary a corpus may use.
 *
 * Upstream mapped twenty-nine names here; most were product (gated quiz and
 * summary, content gate, AI check, PDF viewer, capstone workbook, the ecosystem
 * product pages) or course artifacts. What survives is the corpus-neutral set
 * named in the positive contract of `specs/sor-site/surface/spec.md`.
 *
 * The four bespoke tab families upstream shipped (OS / tool / cowork / web
 * agent), each with its own provider and content wrappers, are gone: the
 * collapsed `@vsor/lib-remark-tabs` emits stock `<Tabs>` / `<TabItem>` from
 * `@theme/Tabs`, so the tab vocabulary is now config in `docusaurus.config.ts`
 * and needs no components of its own.
 *
 * `Quiz` maps to the real quiz, not to a gated wrapper — browser gating is
 * theater in a static site, and the contract excludes it.
 */
import MDXComponents from "@theme-original/MDXComponents";
import Tabs from "@theme/Tabs";
import TabItem from "@theme/TabItem";
import Quiz from "@/components/quiz/Quiz";
import ExerciseCard from "@/components/ExerciseCard";
import LazyFlashcards from "@/components/flashcards/LazyFlashcards";
import LazyConversationGallery from "@/components/gallery/LazyConversationGallery";
import HighlightTip from "@/components/HighlightTip";

export default {
  ...MDXComponents,
  // Stock Docusaurus tabs — the target of the remark-tabs directive transform.
  Tabs,
  TabItem,
  // Four-option quiz with an explanation; the pinned primitive contract.
  Quiz,
  // Callout for a thing the reader should go and do.
  ExerciseCard,
  // Spaced-repetition deck, fed by co-located .flashcards.yaml.
  Flashcards: LazyFlashcards,
  // Side-by-side conversation comparison, fed by co-located .gallery.yaml.
  ConversationGallery: LazyConversationGallery,
  // Inline aside for a short, load-bearing remark beside the prose.
  HighlightTip,
};
