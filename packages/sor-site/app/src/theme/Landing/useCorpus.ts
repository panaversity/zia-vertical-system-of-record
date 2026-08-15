/**
 * What the landing page knows about the corpus, derived — never authored.
 *
 * The docs plugin already publishes everything needed to describe a corpus:
 * every routed document, the route they are published at, and which document is
 * the main one. This hook reads that global data (a native Docusaurus seam, no
 * new plugin, no manifest to keep in sync) and shapes it into cards.
 *
 * What it deliberately does NOT do: invent titles or descriptions it cannot
 * derive. The docs plugin's global data carries ids and routes, not frontmatter,
 * so a card's title is the humanized folder name and its only other line is a
 * document count. An owner who wants real prose passes `sections={[…]}` — the
 * prop exists precisely because derivation must not guess.
 *
 * Safe on a site without the docs plugin: `useAllPluginInstancesData` returns
 * undefined rather than throwing when `failfast` is unset, so a corpus-less site
 * renders the hero and nothing else.
 */
import { useAllPluginInstancesData } from "@docusaurus/useGlobalData";
import type { LandingSection } from "./types";

/** The subset of @docusaurus/plugin-content-docs global data this hook reads. */
type DocsGlobalDoc = {
  id: string;
  path: string;
  unlisted?: boolean;
};
type DocsGlobalVersion = {
  isLast: boolean;
  path: string;
  mainDocId: string;
  docs: DocsGlobalDoc[];
};
type DocsGlobalData = { path: string; versions: DocsGlobalVersion[] };

export type Corpus = {
  /** Documents published under the docs route. */
  documentCount: number;
  /** Top-level folders that became cards; 0 when the corpus is flat. */
  sectionCount: number;
  /** Where the corpus is published, e.g. "/docs". */
  basePath?: string;
  /** The corpus's own main document — the honest default CTA target. */
  mainDocPath?: string;
  /** One card per top-level folder, or per document when the corpus is flat. */
  sections: LandingSection[];
};

const EMPTY: Corpus = { documentCount: 0, sectionCount: 0, sections: [] };

/**
 * A flat corpus becomes one card per document, and a corpus can be large. Cards
 * are a summary, not a table of contents — that is what the sidebar and search
 * are for. Folder cards are never capped: folders are few by nature, and hiding
 * one would hide a whole part of the corpus.
 */
const MAX_DOCUMENT_CARDS = 12;

/** "01-income-tax" -> "Income Tax". Existing capitals are left alone ("API"). */
function humanize(segment: string): string {
  const words = segment
    .replace(/^\d+[-_.\s]*/, "")
    .split(/[-_\s]+/)
    .filter(Boolean);
  if (words.length === 0) {
    return segment;
  }
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** The part of `path` below `base`, or undefined when it is not below it. */
function below(path: string, base: string): string | undefined {
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : undefined;
}

function count(n: number): string {
  return n === 1 ? "1 document" : `${n} documents`;
}

export function useCorpus(): Corpus {
  const instances = useAllPluginInstancesData("docusaurus-plugin-content-docs") as
    | Record<string, DocsGlobalData>
    | undefined;
  if (!instances) {
    return EMPTY;
  }
  const data = instances.default ?? Object.values(instances)[0];
  const version = data?.versions.find((v) => v.isLast) ?? data?.versions[0];
  if (!version) {
    return EMPTY;
  }

  const base = version.path;
  const docs = version.docs.filter((doc) => !doc.unlisted);

  // Group by first path segment below the docs route, in the order the docs
  // plugin hands them over — which is NOT the author's order, and the comment
  // that used to stand here said it was.
  //
  // Measured 2026-08-14 against a nested corpus (tests/fixtures/tiny arranged as
  // 01-mains/, 02-street-food/, 03-drinks-and-sweets/): `version.docs` arrives
  // sorted by id, and Docusaurus's default number-prefix parser has already
  // stripped "01-" from the id as well as from the route — so the cards render
  // drinks, mains, street food. The earlier claim ("the global-data array is
  // still in source order") was measured on the FLAT fixture, where every
  // document is its own card and the two orders coincide.
  //
  // Author order is not recoverable here: the docs plugin's global data carries
  // no sidebar tree, only that sidebar's root link. So no sort is applied (it
  // would change nothing), the order is stated to be the plugin's, and an owner
  // who needs a particular order passes `sections={[…]}` — which is the prop's
  // second reason to exist, alongside descriptions derivation cannot invent.
  const groups = new Map<string, { children: DocsGlobalDoc[]; index?: string }>();
  const singles: { segment: string; doc: DocsGlobalDoc }[] = [];

  for (const doc of docs) {
    const rest = below(doc.path, base);
    if (!rest) {
      continue; // the corpus root index page itself — not a card
    }
    const slash = rest.indexOf("/");
    if (slash === -1) {
      singles.push({ segment: rest, doc });
      continue;
    }
    const key = rest.slice(0, slash);
    const group = groups.get(key) ?? { children: [] };
    group.children.push(doc);
    groups.set(key, group);
  }

  // A single whose segment names a group is that group's index page, not a
  // document card of its own (a folder with both `mains/` docs and `mains.md`).
  const looseDocs: { segment: string; doc: DocsGlobalDoc }[] = [];
  for (const single of singles) {
    const group = groups.get(single.segment);
    if (group) {
      group.index = single.doc.path;
    } else {
      looseDocs.push(single);
    }
  }

  // Array.from, never `[...groups.entries()]`. found live 2026-08-14: Docusaurus's
  // client-side babel target compiles array spread to `[].concat(arg)`, which is
  // correct for arrays and silently wrong for any other iterable — a Map iterator
  // arrives as ONE element, so the first card's key was undefined and the page
  // crashed on hydration while server-rendering perfectly. The rule for this
  // package: spread arrays, call Array.from on everything else.
  const folderCards: LandingSection[] = Array.from(groups.entries()).map(
    ([key, group]) => ({
      title: humanize(key),
      href: group.index ?? group.children[0].path,
      meta: count(group.children.length + (group.index ? 1 : 0)),
      icon: "folder-open" as const,
    }),
  );

  // Only when there are no folders at all: a flat corpus still deserves cards.
  const documentCards: LandingSection[] =
    folderCards.length > 0
      ? []
      : looseDocs.slice(0, MAX_DOCUMENT_CARDS).map(({ segment, doc }) => ({
          title: humanize(segment),
          href: doc.path,
          icon: "file-text" as const,
        }));

  const mainDoc =
    docs.find((doc) => doc.id === version.mainDocId) ?? docs[0] ?? undefined;

  return {
    documentCount: docs.length,
    sectionCount: folderCards.length,
    basePath: base,
    mainDocPath: mainDoc?.path,
    sections: [...folderCards, ...documentCards],
  };
}
