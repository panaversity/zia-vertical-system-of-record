/**
 * The surfaces row — one source, and the places it is served.
 *
 * The band is upstream's two-column technical row (py-24, 1800px measure, ruled
 * cards, bordered icon well); the status badge is the point of the component.
 * A surface that does not run yet is marked "later" and described in the future
 * tense, on the page, in front of the reader — the same rule the repository
 * holds itself to. A row that quietly implied a working MCP server would be the
 * exact failure this badge exists to make impossible.
 */
import { Globe } from "lucide-react";
import React from "react";
import { resolveIcon } from "./icons";
import SectionHeader from "./SectionHeader";
import { step } from "./stagger";
import styles from "./styles.module.css";
import type { LandingSurface } from "./types";

function Badge({ status }: { status: "live" | "later" }) {
  const live = status === "live";
  return (
    <span
      className={
        live
          ? "border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-primary"
          : "border border-border bg-muted px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
      }
    >
      {live ? "live" : "later"}
    </span>
  );
}

export default function Surfaces({
  surfaces,
  kicker,
  heading,
}: {
  surfaces: LandingSurface[];
  kicker: string;
  heading: string;
}) {
  if (surfaces.length === 0) {
    return null;
  }
  return (
    <section className="border-b border-border/40 bg-background py-24">
      <div className="mx-auto max-w-[1800px] px-6 md:px-12 lg:px-16">
        <SectionHeader kicker={kicker} heading={heading} />
        {/* Ruled the same way as the corpus grid: rings on the cards, nothing on
            the container. See SectionCards for why. */}
        <div className="grid grid-cols-1 gap-px md:grid-cols-2">
          {surfaces.map((surface, index) => {
            const Icon = resolveIcon(surface.icon, Globe);
            return (
              <div
                key={surface.title}
                style={step(index % 2)}
                className={`${styles.rise} flex flex-col gap-4 bg-card p-6 ring-1 ring-border lg:p-8`}
              >
                <div className="flex items-center gap-3">
                  <span className="border border-primary/20 bg-primary/10 p-3">
                    <Icon
                      className="block h-6 w-6 text-primary"
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </span>
                  <Badge status={surface.status ?? "live"} />
                </div>
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                  {surface.title}
                </h3>
                <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                  {surface.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
