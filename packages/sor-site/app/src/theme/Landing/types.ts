/**
 * The Landing prop contract — the one public surface of @theme/Landing.
 *
 * Every prop is optional. `<Landing />` with no props is the scaffold's
 * homepage: hero text from siteConfig, cards derived from the corpus itself.
 * A prop is only ever a way to say something the corpus cannot say for you.
 *
 * Nothing here is upstream copy or an upstream link: the words on the page are
 * either the owner's (siteConfig, these props) or derived from the corpus on
 * disk. The three defaults that ARE written — the section heading, the
 * two-surfaces row and the closing band — describe this framework's own
 * contract and how it builds a site, and every one of them is replaceable or
 * removable by prop.
 */
import type { ReactNode } from "react";
import type { LandingIconName } from "./icons";

/** A link: the label a human reads, the route it goes to. */
export type LandingLink = {
  label: string;
  /** Any route Docusaurus can resolve — passed to `<Link to>`. */
  href: string;
};

/**
 * One card in the corpus grid.
 *
 * Derived cards (the default) fill `title`, `href` and `meta` from the docs
 * plugin's own global data. Authored cards may add a `description` and an
 * `icon`, which derivation can never invent.
 */
export type LandingSection = {
  title: string;
  href: string;
  /** One line under the title. Derived cards have none — nothing to derive it from. */
  description?: string;
  /** Small mono line at the foot of the card, e.g. "12 documents". */
  meta?: string;
  /** A lucide icon name; see icons.ts for the resolvable set. */
  icon?: LandingIconName;
};

/**
 * One surface the corpus is served through.
 *
 * `status` is the honesty knob: "later" prints a LATER badge and is the only
 * correct value for anything that does not run yet.
 */
export type LandingSurface = {
  title: string;
  description: string;
  status?: "live" | "later";
  icon?: LandingIconName;
};

export type LandingProps = {
  /** Hero heading. Default: `siteConfig.title`. */
  title?: string;
  /** Hero paragraph. Default: `siteConfig.tagline`. */
  tagline?: string;
  /** Small mono label above the heading. Default: none. */
  eyebrow?: string;
  /**
   * The primary call to action. Default: "Read the knowledge base" pointing at
   * the corpus's own main document (the docs plugin's `mainDocId`), so the link
   * is real on any corpus and stays real when documents are renamed.
   * `false` removes it.
   */
  cta?: LandingLink | false;
  /** A second, quieter link beside the CTA. Default: none. */
  secondaryCta?: LandingLink;
  /**
   * The corpus grid. Default: derived from the docs plugin's global data — one
   * card per top-level folder of `knowledge/`, or one per document when the
   * corpus is flat. `false` removes the whole section.
   *
   * Derived cards come in the docs plugin's own order, which is by id with any
   * numeric prefix already stripped — so `01-`, `02-`, `03-` folders do NOT
   * arrive in that order (see useCorpus). Passing an array is how a corpus with
   * an authored order gets it.
   */
  sections?: LandingSection[] | false;
  /** Grid heading. Default: "What this covers". */
  sectionsHeading?: string;
  /** Mono label above the grid heading. Default: "Contents". */
  sectionsKicker?: string;
  /**
   * The surfaces row. Default: the website (live) and the MCP server (later —
   * `vsor serve` is not implemented). `false` removes the whole section.
   */
  surfaces?: LandingSurface[] | false;
  /** Surfaces heading. Default: "One source, two surfaces". */
  surfacesHeading?: string;
  /** Mono label above the surfaces heading. Default: "Surfaces". */
  surfacesKicker?: string;
  /**
   * The closing band — the page's last beat, carrying the same call to action as
   * the hero so a reader who scrolled the page need not scroll back. `false`
   * removes it; it removes itself when there is no document to link to.
   */
  closing?: false;
  /** Closing heading. Default: "Read it at the source." */
  closingHeading?: string;
  /** Mono label above the closing heading. Default: "Start here". */
  closingKicker?: string;
  /**
   * The sentence under the closing heading. Default: the corpus's own document
   * count and route, plus how this site is built from them. `false` removes it.
   */
  closingDescription?: string | false;
  /** Rendered last, inside the page. Anything else the owner wants to add. */
  children?: ReactNode;
};
