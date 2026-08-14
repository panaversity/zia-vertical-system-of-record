/**
 * The closing band — the page's last beat, and its second way in.
 *
 * Upstream ends on a call to action, and the band before it breaks the rhythm by
 * changing surface (`bg-primary/5`, centred, one heavy statement). Both are kept,
 * merged into one band: after the grid and the surfaces row, a reader who has
 * scrolled the whole page should not have to scroll back to reach the corpus.
 *
 * What could not be kept is everything upstream put IN those two bands — a
 * thesis about one product, three emoji pillars, a fake terminal transcript
 * showing a build that never ran, and a second brand's "explore" link. The
 * shape crossed; not one sentence did.
 *
 * Every word this band prints is derived or replaceable: the count and the route
 * come from the docs plugin's global data, the action is the same one the hero
 * carries (one label for an owner to change, not two), and the two default
 * sentences describe how this framework builds a site — the only subject a
 * framework is entitled to write prose about. The band removes itself when there
 * is no document to send anyone to.
 */
import Link from "@docusaurus/Link";
import { ArrowRight } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import { step } from "./stagger";
import styles from "./styles.module.css";
import type { LandingLink } from "./types";
import type { Corpus } from "./useCorpus";

export const DEFAULT_CLOSING_KICKER = "Start here";
export const DEFAULT_CLOSING_HEADING = "Read it at the source.";

/**
 * The default sentence.
 *
 * It deliberately carries NO number. The hero's manifest already prints the
 * document count and the route, and the grid's mono note prints them again as a
 * caption; a third recital in the closing band would be the page repeating
 * itself rather than closing. What is left is the one thing the page has not yet
 * said, and the only kind of claim a framework is entitled to make — a claim
 * about its own build, not about someone's corpus. The sidebar, the search index
 * and every page are generated from one folder at build time, which is exactly
 * why a vsor site cannot show a document the corpus does not contain. A
 * framework may say that. It may not say the corpus is complete, current or
 * correct — only its owner knows that.
 *
 * The corpus is still the argument: an empty one returns nothing to say.
 */
export function describeCorpus(corpus: Corpus): string | undefined {
  if (corpus.documentCount === 0) {
    return undefined;
  }
  return "Every page, the sidebar beside it and the search index behind it are generated from one folder of documents at build time — so this site cannot show you anything the corpus does not hold.";
}

export default function Closing({
  kicker,
  heading,
  description,
  cta,
}: {
  kicker: string;
  heading: string;
  description?: string;
  cta?: LandingLink;
}) {
  if (!cta) {
    return null;
  }
  return (
    <section className="border-b border-border/40 bg-primary/5 py-24">
      <div className="mx-auto max-w-[1800px] px-6 md:px-12 lg:px-16">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className={`${styles.rise} mb-4 flex items-center gap-2`}>
            <span className="h-2 w-2 bg-primary" aria-hidden="true" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
              {kicker}
            </span>
          </div>
          <h2
            className={`${styles.rise} mb-6 text-3xl font-black tracking-tight text-foreground md:text-4xl lg:text-5xl`}
            style={step(1)}
          >
            {heading}
          </h2>
          {description ? (
            <p
              className={`${styles.rise} mb-10 text-base leading-relaxed text-muted-foreground sm:text-lg`}
              style={step(2)}
            >
              {description}
            </p>
          ) : null}
          <Button
            asChild
            size="lg"
            className={`${styles.rise} h-12 px-6 text-sm font-bold uppercase tracking-wide sm:h-14 sm:px-8 sm:text-base`}
            style={step(3)}
          >
            <Link to={cta.href} className="group no-underline hover:no-underline">
              {cta.label}
              <ArrowRight
                className="transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
