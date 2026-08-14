/**
 * The hero: the corpus's name, its tagline, one way in — and, beside them, what
 * the corpus actually contains.
 *
 * Reworked from the upstream hero (apps/learn-app/src/pages/index.tsx at
 * d764f334). The proportions are upstream's, to the number: an 85vh band, a
 * 1.2fr/1fr split divided by a hairline, the display type black and
 * tracking-tighter at leading-none, the second word on its own line in the
 * primary colour, sharp-cornered actions at h-14, and behind the right column
 * the 40px dot field and the blurred primary spotlight (styles.module.css).
 * That geometry is most of what makes upstream's page feel built rather than
 * assembled, and none of it names a product, so all of it crossed.
 *
 * Three deliberate changes:
 *
 * 1. The display type is NOT uppercased. Upstream's own comment records what
 *    all-caps costs ("it case-mangles the product names"); upstream then applied
 *    it to the h1 anyway, which is safe when the h1 is one fixed brand and unsafe
 *    when it is whatever an owner named their project. The label register — mono,
 *    small, widest tracking — keeps the uppercase, which is where upstream's note
 *    says it belongs.
 * 2. The right column is derived, not decorative. Upstream put a 3D book render
 *    there; a system of record has something truer to show — how much it holds.
 *    It is a real manifest: every number comes from the docs plugin's own global
 *    data, so it cannot drift from the corpus and cannot be inflated.
 * 3. Under the actions upstream ran a pulsing live dot, a learner count, a
 *    reviews link and a row of contributor chips. A framework has no honest
 *    version of any of those — an invented count is the one thing a system of
 *    record must never print — so the row is gone rather than reworded, and the
 *    entrance animation it existed to carry moved onto the content itself.
 *
 * The `m-0` on the manifest list and its rows, and `no-underline` on the two
 * actions, are not decoration: this package ships no Tailwind preflight (see
 * src/css/tailwind.css), so a <dd> carries the browser's 40px indent and an <a>
 * carries Infima's hover underline unless the component says otherwise.
 */
import Link from "@docusaurus/Link";
import { ArrowRight, FolderOpen } from "lucide-react";
import React from "react";
import { Button } from "../../ui/button";
import { step } from "./stagger";
import styles from "./styles.module.css";
import type { LandingLink } from "./types";
import type { Corpus } from "./useCorpus";

/** Splits "Pakistan Tax Law" into ["Pakistan Tax", "Law"]; one word stays whole. */
function splitTitle(title: string): [string, string] {
  const words = title.trim().split(/\s+/);
  if (words.length < 2) {
    return ["", title];
  }
  return [words.slice(0, -1).join(" "), words[words.length - 1]];
}

function ManifestRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border px-4 py-3 last:border-b-0">
      <dt className="m-0 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="m-0 font-mono text-sm font-semibold text-foreground">
        {value}
      </dd>
    </div>
  );
}

export default function Hero({
  title,
  tagline,
  eyebrow,
  cta,
  secondaryCta,
  corpus,
}: {
  title: string;
  tagline?: string;
  eyebrow?: string;
  cta?: LandingLink;
  secondaryCta?: LandingLink;
  corpus: Corpus;
}) {
  const [head, tail] = splitTitle(title);
  // No corpus, no manifest — and then no second column at all, rather than a
  // hairline with nothing behind it.
  const hasManifest = corpus.documentCount > 0;
  return (
    <header className="relative overflow-hidden border-b border-border/40 bg-background">
      <div className="mx-auto max-w-[1800px]">
        <div
          className={
            hasManifest
              ? "grid min-h-[85vh] grid-cols-1 lg:grid-cols-[1.2fr_1fr]"
              : "grid min-h-[70vh] grid-cols-1"
          }
        >
          <div
            className={
              hasManifest
                ? "flex flex-col justify-center border-border/40 px-6 py-16 md:px-12 lg:border-r lg:px-16 lg:py-24"
                : "flex flex-col justify-center px-6 py-16 md:px-12 lg:px-16 lg:py-24"
            }
          >
            {eyebrow ? (
              <span
                className={`${styles.rise} mb-8 inline-flex w-fit items-center border border-primary/40 bg-primary/[0.06] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-primary`}
              >
                {eyebrow}
              </span>
            ) : null}

            {/* Upstream's two-line display treatment: the last word drops to its
                own line in the primary colour, which is what gives a short title
                the height of a headline. A one-word title renders one line — the
                head is empty and the block span is the whole h1. */}
            <h1
              className={`${styles.rise} mb-6 text-4xl font-black leading-none tracking-tighter text-foreground sm:text-5xl md:text-6xl lg:text-7xl`}
              style={step(1)}
            >
              {head ? <span className="block">{head}</span> : null}
              <span className="mt-1 block text-primary">{tail}</span>
            </h1>

            {tagline ? (
              <p
                className={`${styles.rise} mb-10 max-w-xl text-base leading-[1.6] text-muted-foreground sm:text-lg lg:text-xl`}
                style={step(2)}
              >
                {tagline}
              </p>
            ) : null}

            {cta || secondaryCta ? (
              <div
                className={`${styles.rise} flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4`}
                style={step(3)}
              >
                {cta ? (
                  <Button
                    asChild
                    size="lg"
                    className="h-12 px-6 text-sm font-bold uppercase tracking-wide sm:h-14 sm:px-8 sm:text-base"
                  >
                    <Link to={cta.href} className="group no-underline hover:no-underline">
                      {cta.label}
                      <ArrowRight
                        className="transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  </Button>
                ) : null}
                {secondaryCta ? (
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-12 px-6 text-sm font-bold uppercase tracking-wide sm:h-14 sm:px-8 sm:text-base"
                  >
                    <Link
                      to={secondaryCta.href}
                      className="no-underline hover:no-underline"
                    >
                      {secondaryCta.label}
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>

          {hasManifest ? (
            <div className="relative flex min-h-[25rem] items-center justify-center px-6 py-12 md:px-12 lg:px-10 lg:py-24">
              <div className={styles.dotField} aria-hidden="true" />
              <div className={styles.spotlight} aria-hidden="true" />
              <dl
                className={`${styles.rise} relative z-10 m-0 w-full max-w-md border border-border bg-card`}
                style={step(2)}
              >
                <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                  <FolderOpen
                    className="h-4 w-4 text-primary"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    knowledge/
                  </span>
                </div>
                <ManifestRow
                  label="documents"
                  value={String(corpus.documentCount)}
                />
                {corpus.sectionCount > 0 ? (
                  <ManifestRow
                    label="sections"
                    value={String(corpus.sectionCount)}
                  />
                ) : null}
                {corpus.basePath ? (
                  <ManifestRow label="published at" value={corpus.basePath} />
                ) : null}
              </dl>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
