/**
 * The homepage.
 *
 * Upstream's was 1,698 lines of book marketing — a hero for one title, a
 * maturity ladder, a comparison table, a pricing grid, four monetization models,
 * a wall of contributor chips, a live-count badge, a fake IDE. Every sentence of
 * it named a product the surface contract excludes, so none of it crossed.
 *
 * What crossed is the CRAFT: the 85vh hero split 1.2fr/1fr by a hairline, the
 * black tracking-tighter display type with the last word dropped into the
 * primary colour, the dot field and blurred spotlight behind the right column,
 * the py-24 band rhythm over a 1800px measure, the mono kickers and comment-
 * syntax notes, the one-pixel-ruled card grid, the sharp corners, the staggered
 * entrance, and the change of surface on the closing band.
 *
 * `@theme/Landing` fills that geometry from the site's own configuration and the
 * corpus's own folders, so a project gets this page without writing a line of
 * it: the title and tagline are the owner's, the cards are the corpus's
 * top-level folders, the counts and routes are the docs plugin's, and the only
 * framework-authored prose describes how the framework builds a site. An owner
 * who wants more passes props here; an owner who wants a different page replaces
 * this file.
 */
import React from "react";
import Landing from "@/theme/Landing";

export default function Home(): React.ReactElement {
  return <Landing />;
}
