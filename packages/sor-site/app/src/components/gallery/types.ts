/**
 * Gallery types — extracted from ag2/apps/learn-app/src/components/gallery/
 * types.ts at d764f334, unchanged apart from dropping the upstream comment's
 * reference to progress-types.ts (progress machinery stays behind).
 * TypeScript types for the .gallery.yaml schema and React components.
 */

export interface GalleryScores {
  independent_thinking: number;
  critical_evaluation: number;
  reasoning_depth: number;
  originality: number;
  self_awareness: number;
}

export interface StudentField {
  name: string;
  start_marker: string;
  end_marker?: string;
}

export interface GalleryConversation {
  id: string;
  label: string;
  provider: string;
  student_input: string;
  ai_output: string;
  scores: GalleryScores;
  commentary: string;
  student_fields?: StudentField[];
}

export interface GalleryData {
  exercise_id: string;
  conversations: GalleryConversation[];
}

/** Shape of the parsed .gallery.yaml file */
export interface GalleryYaml {
  gallery: GalleryData;
}

/** Props for the ConversationGallery component */
export interface ConversationGalleryProps {
  /** Injected by remark-gallery plugin at build time */
  gallery?: GalleryYaml | null;
}
