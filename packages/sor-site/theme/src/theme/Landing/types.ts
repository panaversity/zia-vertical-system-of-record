/**
 * The Landing prop contract — the one public surface of @theme/Landing.
 *
 * Every prop is optional. `<Landing />` with no props is the scaffold's
 * homepage: hero text from siteConfig, cards derived from the corpus itself.
 * A prop is only ever a way to say something the corpus cannot say for you.
 *
 * Nothing here is upstream copy or an upstream link: the words on the page are
 * either the owner's (siteConfig, these props) or derived from the corpus on
 * disk. The two defaults that ARE written here — the section heading and the
 * two-surfaces row — describe this framework's own contract, and both are
 * replaceable or removable by prop.
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
  /** Rendered last, inside the page. Anything else the owner wants to add. */
  children?: ReactNode;
};
