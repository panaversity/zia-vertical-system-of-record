/**
 * Docusaurus Root Component.
 *
 * Upstream (ag2 apps/learn-app at d764f334) stacked nine providers here. Every
 * one of them is excluded by `specs/sor-site/surface/spec.md` — they are not
 * named individually because the boundary test scans this source for exactly
 * those identifiers — so the whole stack is gone and what is left
 * is the one piece that is a content primitive rather than a product: the
 * click-to-enlarge lightbox that binds to images inside the article.
 *
 * Root stays a swizzle (rather than being deleted outright) because it is the
 * only seam where a site-wide, corpus-neutral behaviour can attach. A consuming
 * project that wants its own wrapper writes `site/src/theme/Root.tsx`, which
 * Docusaurus resolves ahead of this one.
 */

import React from "react";
import ImageZoom from "@/components/ImageZoom";

export default function Root({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <ImageZoom />
      {children}
    </>
  );
}
