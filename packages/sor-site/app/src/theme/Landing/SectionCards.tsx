/**
 * The corpus grid — what this system of record covers.
 *
 * Reworked from upstream's FeaturesSection (apps/learn-app/src/pages/index.tsx at
 * d764f334): the same band rhythm (py-24 over a 1800px measure, closed by a 40%
 * hairline), the same one-pixel-ruled grid, the same bordered icon well and the
 * same soft hover — with the rules drawn differently (see the grid below) and
 * the cards derived instead of hand-written. Upstream wrote six cards about one
 * book; ours are the corpus's own top-level folders, so the grid is right on a
 * corpus of three documents and on a corpus of three thousand.
 *
 * Each card is a link, and every word on it is either the owner's or derived.
 */
import Link from "@docusaurus/Link";
import { ArrowRight, FileText } from "lucide-react";
import React from "react";
import { resolveIcon } from "./icons";
import SectionHeader from "./SectionHeader";
import { step } from "./stagger";
import styles from "./styles.module.css";
import type { LandingSection } from "./types";

/**
 * The link colour and the hover underline ARE named here, and must be. Infima
 * paints every `<a>` from --ifm-link-* and underlines it on hover; upstream
 * gets away with saying nothing because Tailwind's preflight ships
 * `a { color: inherit; text-decoration: inherit }`. This package does not ship
 * preflight (src/css/tailwind.css records why), so an unstated card link comes
 * out Infima link-teal and underlines under the cursor — measured live
 * 2026-08-14, first with a modern browserslist and then again with preflight
 * removed, the same result both times. `text-inherit` keeps the card's own
 * two-tone text (heading foreground, description muted) intact.
 *
 * `index` is the stagger position only. It is deliberately not capped: the
 * delay is 90ms a step and a corpus with twenty folders would take almost two
 * seconds to finish arriving, so the cap lives on the delay instead — see the
 * modulo below, which restarts the stagger every row.
 */
function Card({ section, index }: { section: LandingSection; index: number }) {
  const Icon = resolveIcon(section.icon, FileText);
  return (
    <Link
      to={section.href}
      style={step(index % 3)}
      className={`${styles.rise} group flex flex-col items-start gap-4 bg-card p-6 text-inherit no-underline ring-1 ring-border transition-colors hover:bg-muted/30 hover:text-inherit hover:no-underline`}
    >
      <span className="border border-primary/20 bg-primary/10 p-3 transition-colors group-hover:bg-primary/20">
        <Icon className="block h-6 w-6 text-primary" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <div className="flex-1">
        <h3 className="mb-2 flex items-center gap-2 text-base font-bold tracking-tight text-foreground">
          {section.title}
          <ArrowRight
            className="h-4 w-4 -translate-x-1 text-primary opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
            aria-hidden="true"
          />
        </h3>
        {section.description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {section.description}
          </p>
        ) : null}
      </div>
      {section.meta ? (
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          {section.meta}
        </span>
      ) : null}
    </Link>
  );
}

export default function SectionCards({
  sections,
  kicker,
  heading,
  note,
}: {
  sections: LandingSection[];
  kicker: string;
  heading: string;
  note?: string;
}) {
  if (sections.length === 0) {
    return null;
  }
  return (
    <section className="border-b border-border/40 bg-background py-24">
      <div className="mx-auto max-w-[1800px] px-6 md:px-12 lg:px-16">
        <SectionHeader kicker={kicker} heading={heading} note={note} />
        {/* The ruled grid, with one correction to upstream's. Upstream draws the
            rules by showing a border-coloured background through `gap-px`, which
            works only because it hand-writes exactly six cards into a three-column
            grid. A corpus supplies whatever number it has, and a partial last row
            turned the leftover cells into a grey block (seen live 2026-08-14, ten
            cards in three columns; a `bg-card` container only made it subtler —
            invisible in light, a lighter band in dark). So the container paints
            nothing and each card draws its own 1px ring: adjacent rings coincide
            inside the 1px gap, giving the identical rules, and an unfilled cell is
            simply the page. */}
        <div className="grid grid-cols-1 gap-px md:grid-cols-2 lg:grid-cols-3">
          {sections.map((section, index) => (
            <Card key={section.href} section={section} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
