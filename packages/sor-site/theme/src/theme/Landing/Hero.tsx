/**
 * The hero: the corpus's name, its tagline, one way in — and, beside them, what
 * the corpus actually contains.
 *
 * Reworked from the upstream hero (apps/learn-app/src/pages/index.tsx at
 * d764f334): same structural language — full-bleed band, asymmetric two-column
 * grid divided by a hairline, black tracking-tighter display type, sharp-cornered
 * primary action — with two deliberate changes.
 *
 * 1. The display type is NOT uppercased. Upstream's own comment records what
 *    all-caps costs ("it case-mangles the product names"); upstream then applied
 *    it to the h1 anyway, which is safe when the h1 is one fixed brand and unsafe
 *    when it is whatever an owner named their project. The label register — mono,
 *    small, widest tracking — keeps the uppercase, which is where upstream's note
 *    says it belongs.
 * 2. The right column is derived, not decorative. Upstream put a 3D book render
 *    there; a system of record has something truer to show — how much it holds.
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
  return (
    <header className="relative overflow-hidden border-b border-border bg-background">
      <div className="mx-auto max-w-[1800px]">
        <div className="grid grid-cols-1 lg:min-h-[56vh] lg:grid-cols-[1.25fr_1fr]">
          <div className="flex flex-col justify-center border-border px-6 py-16 md:px-12 lg:border-r lg:px-16 lg:py-24">
            {eyebrow ? (
              <span className="mb-8 inline-flex w-fit items-center border border-primary/40 bg-primary/[0.06] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-primary">
                {eyebrow}
              </span>
            ) : null}

            <h1 className="mb-6 text-4xl font-black leading-[0.95] tracking-tighter text-foreground sm:text-5xl lg:text-6xl xl:text-7xl">
              {head ? `${head} ` : null}
              <span className="text-primary">{tail}</span>
            </h1>

            {tagline ? (
              <p className="mb-10 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {tagline}
              </p>
            ) : null}

            {cta || secondaryCta ? (
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
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

          {corpus.documentCount > 0 ? (
            <div className="flex items-center justify-center px-6 py-12 md:px-12 lg:px-10 lg:py-24">
              <dl className="m-0 w-full max-w-md border border-border bg-card">
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
