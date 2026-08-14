// Your homepage.
//
// <Landing /> reads everything it shows: the title and tagline come from
// site/docusaurus.config.ts, the cards come from the top-level folders of
// ../knowledge — add a folder of documents and a card appears — and the counts
// and routes come from the build itself, so no number on this page can be wrong.
// There is no copy to maintain here and none to delete.
//
// Props are for what the corpus cannot say about itself, e.g.
//   <Landing eyebrow="Updated monthly" sectionsHeading="The chapters" />
//   <Landing sections={[{ title: "Rulings", href: "/docs/rulings",
//                         description: "Every published ruling, by year." }]} />
//   <Landing cta={{ label: "Start reading", href: "/docs/intro" }} />
//   <Landing surfaces={false} />        // drop the "one source, two surfaces" row
//   <Landing closing={false} />         // drop the closing call to action
//   <Landing closingHeading="Look it up." closingDescription={false} />
//
// To own the whole page instead of configuring it, stop rendering <Landing /> and
// write the page here. This whole directory replaces the runtime's `src/pages`, so
// every non-doc route is yours; `@theme/…` components and the runtime's `@/…`
// aliases stay importable from inside it.
import Landing from "@theme/Landing";
import type { ReactNode } from "react";

export default function Home(): ReactNode {
  return <Landing />;
}
