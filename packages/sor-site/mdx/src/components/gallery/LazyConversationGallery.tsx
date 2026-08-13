/**
 * LazyConversationGallery — extracted from ag2/apps/learn-app/src/components/
 * gallery/LazyConversationGallery.tsx at d764f334, unchanged. This is what
 * MDXComponents maps the `ConversationGallery` name to.
 *
 * found live: same constraint as LazyFlashcards — client code ships as ESM;
 * CJS emit broke the module's exports under the site's webpack (2026-08-13).
 */
import React, { lazy, Suspense } from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";
import type { ConversationGalleryProps } from "./types";

const ConversationGallery = lazy(() => import("./ConversationGallery"));

export default function LazyConversationGallery(
  props: ConversationGalleryProps,
) {
  return (
    <BrowserOnly fallback={<div style={{ minHeight: 80 }} />}>
      {() => (
        <Suspense
          fallback={<div style={{ minHeight: 80 }}>Loading gallery...</div>}
        >
          <ConversationGallery {...props} />
        </Suspense>
      )}
    </BrowserOnly>
  );
}
