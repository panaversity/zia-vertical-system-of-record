// Your homepage.
//
// <Landing /> reads everything it shows: the title and tagline come from
// site/docusaurus.config.ts, and the cards come from the top-level folders of
// ../knowledge — add a folder of documents and a card appears. There is no copy
// to maintain here and none to delete.
//
// Props are for what the corpus cannot say about itself, e.g.
//   <Landing eyebrow="Updated monthly" sectionsHeading="The chapters" />
//   <Landing sections={[{ title: "Rulings", href: "/docs/rulings",
//                         description: "Every published ruling, by year." }]} />
//   <Landing surfaces={false} />        // drop the "one source, two surfaces" row
//
// To own the whole page instead of configuring it, write your own component at
// site/src/theme/Landing/index.tsx: Docusaurus resolves site/src/theme before any
// installed theme, so yours is the one that renders (this is what `docusaurus
// swizzle --eject` automates elsewhere, and the destination it would use).
import Landing from "@theme/Landing";
import type { ReactNode } from "react";

export default function Home(): ReactNode {
  return <Landing />;
}
