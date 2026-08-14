/**
 * The hero: the corpus's name, its tagline, one way in — and, beside them, what
 * the corpus actually contains.
 *
 * Reworked from the upstream hero (apps/learn-app/src/pages/index.tsx and
 * index.module.css at d764f334). The proportions are upstream's: a 32px-inset
 * band (styles.module.css `.heroFrame`) holding a 1.2fr/1fr grid divided by a
 * hairline, the display type UPPERCASE and black and tracking-tighter at
 * leading-none (measured on upstream at 1440px: 72px / 900 / -3.6px), the
 * sub-head ramping 14→20px, the last word on its own line in the primary colour
 * at upstream's looser `tracking-tight`, sharp-cornered actions at h-14 with an
 * 18px label, and behind the right column the 40px dot field and the blurred
 * primary spotlight. That geometry is most of what makes upstream's page feel
 * built rather than assembled, and none of it names a product, so all of it
 * crossed.
 *
 * The ONE proportion that is deliberately not upstream's is the reserved height,
 * and the reason is the divergence in (2)+(3) below rather than taste. Measured
 * 2026-08-14 at 1440x900 against upstream's own built hero: upstream fills its
 * 100vh band because its left column carries a kicker, a two-line h1, two
 * paragraphs, two actions, a social-proof row and a row of author chips — 724px
 * of ink in a 917px band, 79%. Ours carries an eyebrow, a name, a tagline and
 * one action, and it must, because the rest of upstream's content is either
 * product copy or a number a framework cannot honestly invent. Reproducing the
 * band without the content mass put a 282px block in the middle of 900px of
 * nothing — the page read as a template rather than a product, which is the
 * exact complaint the design system was brought across to answer. So the band is
 * sized to what it holds and capped (`min(100vh, 38rem)`; the grid `min(85vh,
 * 30rem)`): still a full-bleed opening on a laptop, with the next band showing
 * at the fold instead of half a screen of background.
 *
 * Three deliberate changes:
 *
 * 1. The uppercase is a CSS `text-transform` on the h1, never a transformed
 *    string. Upstream's own comment records what all-caps costs ("it
 *    case-mangles the product names") and upstream could ignore it, because its
 *    h1 is one fixed brand it controls; ours is whatever an owner typed. So the
 *    display *register* is upstream's and the *text* stays exactly as authored:
 *    the DOM node still reads "Pakistan Tax Law" and only the pixels are
 *    capitals.
 *
 *    found live 2026-08-14 (Chromium 151, built fixture site): `text-transform`
 *    alone does NOT keep that promise for assistive technology. The accessible
 *    name is computed from *rendered* text, so the heading whose DOM text is
 *    "fixture" reported an accessible name of "FIXTURE" — a screen reader is
 *    then free to spell a short all-caps string letter by letter, and it
 *    announces an owner's project under a case they did not choose. The `title`
 *    element, the navbar brand and the search index were all unaffected; it is
 *    only the heading, and only because of the transform. The `aria-label` below
 *    is the fix, verified the same way: the accessible name is the authored
 *    string again, while the visible register stays upstream's.
 * 2. The right column is derived, not decorative. Upstream put a 3D book render
 *    there; a system of record has something truer to show — how much it holds.
 *    It is a real manifest: every number comes from the docs plugin's own global
 *    data, so it cannot drift from the corpus and cannot be inflated.
 * 3. Under the actions upstream ran a pulsing live dot, an audience count, a
 *    reviews link and a row of contributor chips. A framework has no honest
 *    version of any of those — an invented count is the one thing a system of
 *    record must never print — so the row is gone rather than reworded, and the
 *    entrance animation it existed to carry moved onto the content itself.
 *    Upstream's kicker DID survive, as the eyebrow: see DEFAULT_EYEBROW in
 *    ./index.tsx, which states what the site is rather than what it sells.
 *
 * One divergence that is not upstream's and is not a copy: the CTA label is
 * uppercased in CSS (`uppercase tracking-wide`) where upstream authored the
 * capitals into the string. Same argument as (1) — the label is a prop an owner
 * can replace, so the case belongs to the pixels and not to their words.
 *
 * The `m-0` on the manifest list and its rows, and `no-underline` on the two
 * actions, are not decoration: this package ships no Tailwind preflight (see
 * src/css/custom.css, which imports tailwindcss and deliberately not its
 * preflight), so a <dd> carries the browser's 40px indent and an <a> carries
 * Infima's hover underline unless the component says otherwise.
 */
import Link from "@docusaurus/Link";
import { ArrowRight, FolderOpen } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";
import { step } from "./stagger";
import styles from "./styles.module.css";
import type { LandingLink } from "./types";
import type { Corpus } from "./useCorpus";

/**
 * The two lines of the display treatment, and where the brand colour lands.
 *
 * **The rule: the accent marks the last word of a MULTI-word name. A one-word
 * name is set whole, in the foreground.**
 *
 *   "Pakistan Tax Law"            PAKISTAN TAX / LAW           accent on LAW
 *   "Airworthiness Directives"    AIRWORTHINESS / DIRECTIVES   accent on the 2nd
 *   "Ledger"                      LEDGER                       no accent
 *
 * (The examples are deliberately not upstream's own title: the A2 boundary scan
 * reads this file, and its brand pattern is case-insensitive — it caught the
 * first draft of this comment, which is the tier working.)
 *
 * Upstream's h1 is one fixed four-word brand, so "colour the last word" was a
 * decision it only had to make once. Ours is whatever an owner typed into
 * `docusaurus.config.ts`, and the old rule read the one-word case as *all* last
 * word: the entire h1 went to the brand colour — which is the fixture's case,
 * and the common case for a corpus named after its subject ("Ledger",
 * "Vsor", "Compliance"). Three things go wrong at once when it does. A 72px
 * name in the accent colour reads as a link rather than a wordmark; it collides
 * with the accent-coloured primary action sitting directly under it, so the two
 * loudest things on the page are the same colour; and the two-tone contrast that
 * makes upstream's treatment work needs two tones.
 *
 * Rejected alternative: splitting a single word across two lines to manufacture
 * a tail (LED/GER). It reads as a typo, and on a name the framework did not
 * author, hyphenating someone's project is not ours to do.
 *
 * The hero is not left without the brand colour when a name is one word: the
 * primary action, the eyebrow, the manifest's folder icon and the dark-mode
 * spotlight all still carry it. What changes is that the *name* is no longer
 * the thing carrying it.
 */
type DisplayName = {
  /** Every word but the last, on its own line. Absent for a one-word name. */
  lead?: string;
  /** The last word — the accented line, when there is something to accent. */
  last: string;
  accent: boolean;
};

function splitTitle(title: string): DisplayName {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return { last: title.trim(), accent: false };
  }
  return {
    lead: words.slice(0, -1).join(" "),
    last: words[words.length - 1],
    accent: true,
  };
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
  const { lead, last, accent } = splitTitle(title);
  // No corpus, no manifest — and then no second column at all, rather than a
  // hairline with nothing behind it.
  const hasManifest = corpus.documentCount > 0;
  return (
    <header
      className={`${styles.heroFrame} overflow-hidden border-b border-border/40 bg-background`}
    >
      {/* w-full is this file's one addition to upstream's markup: `.heroFrame`
          is a flex container, and a block flex item without it sizes to its
          content — which would let a short name pull the whole grid narrower
          than the band it sits in. */}
      <div className="relative z-10 mx-auto w-full max-w-[1800px]">
        <div
          className={
            hasManifest
              ? `${styles.heroGrid} grid grid-cols-1 lg:grid-cols-[1.2fr_1fr]`
              : `${styles.heroGridBare} grid grid-cols-1`
          }
        >
          <div
            className={
              hasManifest
                ? "flex flex-col justify-center border-border/40 px-6 py-12 md:px-12 lg:border-r lg:px-16 lg:py-0"
                : "flex flex-col justify-center px-6 py-12 md:px-12 lg:px-16 lg:py-0"
            }
          >
            {eyebrow ? (
              <span
                className={`${styles.rise} mb-8 inline-flex w-fit items-center border border-primary/40 bg-primary/[0.06] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-primary`}
              >
                {eyebrow}
              </span>
            ) : null}

            {/* Upstream's display treatment, whole: uppercase, black, at the
                72px/-3.6px end of the scale, the last word dropped to its own
                line in the primary colour. See splitTitle for where the colour
                lands and why; see the file docblock for why the capitals are a
                text-transform and not a transformed string.

                `text-balance` is not upstream's, and it exists for the same
                reason the colour rule does: upstream's h1 is authored to fit its
                column and never wraps, while ours is a name of unknown length.
                Balanced wrapping is what keeps a long lead from breaking as a
                full line plus a one-word orphan.

                Negative result, measured 2026-08-14 before writing it (built
                fixture site, 1440x900 and 375x812): a length-driven step-down of
                the type scale was drafted for long names and is NOT here,
                because the failure it was for does not happen. At the full 72px
                scale a five-word, 54-character name ("Aviation Maintenance
                Airworthiness Directives Register") sets in five lines, 364px
                tall inside a 772px band — a poster, not a defect — and a
                33-character single word (Bundesausbildungsförderungsgesetz)
                breaks rather than overflows, because the chrome already carries
                `overflow-wrap: break-word`. Measured overflow past the column
                was 0px in every case at both widths. A ramp would have been a
                mechanism with no failure under it. */}
            <h1
              // The authored case, restored for assistive technology — see (1)
              // in the file docblock. Same words, same order, only the case
              // differs from what is painted, so nothing a reader hears and
              // nothing a reader sees disagree about what this site is called.
              aria-label={title || undefined}
              className={`${styles.rise} mb-6 text-balance text-4xl font-black uppercase leading-none tracking-tighter text-foreground sm:text-5xl md:text-6xl lg:text-7xl`}
              style={step(1)}
            >
              {lead ? <span className="block">{lead}</span> : null}
              {/* `tracking-tight`, not the h1's `tracking-tighter`: upstream
                  deliberately loosens the accented second line (-0.025em where
                  the heading sets -0.05em), which at 72px is 1.8px of letter
                  spacing rather than 3.6px on the single most prominent word on
                  the page. Inheriting the heading's value set it twice as tight
                  as the treatment it was copied from. */}
              <span className={accent ? "mt-1 block text-primary tracking-tight" : "block"}>
                {last}
              </span>
            </h1>

            {tagline ? (
              <p
                className={`${styles.rise} mb-10 max-w-xl text-sm leading-[1.6] text-muted-foreground sm:text-base md:text-lg lg:text-xl`}
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
                    className="h-12 px-6 text-sm font-bold uppercase tracking-wide sm:h-14 sm:px-8 sm:text-lg"
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
                    className="h-12 px-6 text-sm font-bold uppercase tracking-wide sm:h-14 sm:px-8 sm:text-lg"
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

          {/* `lg:min-h-[25rem]`, not `min-h-[25rem]`: the 400px floor exists to
              give the dot field and the spotlight room BESIDE the text at lg.
              Below lg the two columns stack, so it reserved 400px under a column
              that had just ended — measured 2026-08-14 at 375x812, a 198px empty
              band between the call to action and the manifest panel, on every
              project-name length. */}
          {hasManifest ? (
            <div className="relative flex items-center justify-center px-6 py-6 md:px-12 lg:min-h-[25rem] lg:px-10 lg:py-24">
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
