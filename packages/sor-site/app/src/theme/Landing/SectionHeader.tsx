/**
 * The section header used by every band below the hero.
 *
 * Upstream's technical register, kept to the number: a 2px square in the primary
 * colour, a mono uppercase kicker, a black heading, a hairline rule at 40% with
 * 8/12 of space under it, and — on wide screens — a right-aligned mono note in
 * comment syntax. The band rhythm this sits inside is upstream's too: py-24,
 * a 1800px measure, and 6/12/16 padding steps.
 *
 * The note only ever carries something DERIVED (document counts, routes); there
 * is no place here for a sentence a framework would have had to invent for
 * someone else's corpus.
 */
import React from "react";
import styles from "./styles.module.css";

export default function SectionHeader({
  kicker,
  heading,
  note,
}: {
  kicker: string;
  heading: string;
  note?: string;
}) {
  return (
    <div
      className={`${styles.rise} mb-12 flex flex-col gap-6 border-b border-border/40 pb-8 md:flex-row md:items-end md:justify-between`}
    >
      <div className="max-w-2xl">
        <div className="mb-4 flex items-center gap-2">
          <span className="h-2 w-2 bg-primary" aria-hidden="true" />
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
            {kicker}
          </span>
        </div>
        <h2 className="text-3xl font-black tracking-tight text-foreground md:text-4xl">
          {heading}
        </h2>
      </div>
      {note ? (
        <p className="hidden max-w-md text-right font-mono text-sm text-muted-foreground md:block">
          {`// ${note}`}
        </p>
      ) : null}
    </div>
  );
}
