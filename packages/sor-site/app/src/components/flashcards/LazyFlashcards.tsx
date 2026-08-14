/**
 * LazyFlashcards — extracted from ag2/apps/learn-app/src/components/
 * flashcards/LazyFlashcards.tsx at d764f334, unchanged: BrowserOnly + lazy so
 * SSG never executes the interactive deck. This is what MDXComponents maps
 * the `Flashcards` name to.
 *
 * found live (2026-08-13, stock preset-classic build): this package's client
 * code must ship as ESM — mixing import() or babel-injected ESM helpers into
 * CJS emit broke the module's exports under the site's webpack (SSG-side as
 * MDX "Expected component `Flashcards` to be defined", browser-side as
 * "exports is not defined"). With ESM emit the import() below stays a real
 * dynamic import and the deck splits into its own chunk again.
 */
import React, { lazy, Suspense } from "react";
import BrowserOnly from "@docusaurus/BrowserOnly";
import type { FlashcardsProps } from "./types";

const Flashcards = lazy(() => import("./Flashcards"));

export default function LazyFlashcards(props: FlashcardsProps) {
  return (
    <BrowserOnly fallback={<div style={{ minHeight: 300 }} />}>
      {() => (
        <Suspense
          fallback={
            <div style={{ minHeight: 300 }}>Loading flashcards...</div>
          }
        >
          <Flashcards {...props} />
        </Suspense>
      )}
    </BrowserOnly>
  );
}
