/**
 * Footer — a full swizzle of Docusaurus's @theme/Footer.
 *
 * Copied from ag2 apps/learn-app src/theme/Footer/index.tsx at d764f334 and
 * reworked on the way across. What crossed is the LAYOUT GRAMMAR: a wide brand
 * block beside link columns, uppercase column headings in the muted tone, quiet
 * links that come forward on hover, a hairline above the closing line. What did
 * not cross is every word and destination it carried — the publisher's name and
 * social accounts, the big-type wordmark, the four company links, the product
 * links, and the runtime switch that hid half of them on one host.
 *
 * CONTENT-DRIVEN: everything rendered here comes from `themeConfig.footer`
 * (`links`, `copyright`, `logo`) and `siteConfig.title`. Both of Docusaurus's
 * documented `links` shapes work — an array of `{title, items}` columns, or a
 * flat array of link items — and link items are rendered by Docusaurus's own
 * @theme/Footer/LinkItem, so `to`/`href`, base-url handling and the external
 * link icon behave exactly as the framework documents. No footer at all when
 * `themeConfig.footer` is absent, matching stock. Acceptance B12 asserts the
 * copyright seam is live: change it in the config, the built page changes.
 *
 * Palette: this file names no color literal — every tone is a design token
 * (`text-muted-foreground`, `text-foreground`, `border-border`).
 *
 * found live 2026-08-14 (themed fixture build, docusaurus 3.10.2 + tailwind
 * 4.3.3): link colors have to be named here and cannot be left to Infima's
 * `.footer__link-item`. Tailwind's preflight ships `a { color: inherit }`, and
 * the build's `@layer` emulation gives that rule a three-id specificity boost —
 * so it outranks every one of Infima's plain-class link rules, and
 * `--ifm-footer-link-color` (which the token file does bridge) stops reaching
 * the anchor the moment this design system is on. Evidence: with the bridge
 * resolving to #737373, the rendered link still computed rgb(10,10,10),
 * inherited from the footer. The same trap governs the navbar items.
 */

import React from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import useBaseUrl from "@docusaurus/useBaseUrl";
import {
  ThemeClassNames,
  isMultiColumnFooterLinks,
  useThemeConfig,
} from "@docusaurus/theme-common";
import ThemedImage from "@theme/ThemedImage";
import LinkItem from "@theme/Footer/LinkItem";
import { cn } from "../../lib/utils";

interface FooterLink {
  label?: string;
  html?: string;
  className?: string;
  to?: string;
  href?: string;
  [key: string]: unknown;
}

interface FooterColumn {
  title?: string;
  className?: string;
  items: FooterLink[];
}

// Docusaurus's own discriminator for the two documented `links` shapes, given
// this file's types — one cast, stated once, instead of one at each use.
const isColumns = isMultiColumnFooterLinks as unknown as (
  links: (FooterLink | FooterColumn)[],
) => links is FooterColumn[];

interface FooterLogo {
  src: string;
  srcDark?: string;
  alt?: string;
  href?: string;
  width?: string | number;
  height?: string | number;
  target?: string;
  style?: React.CSSProperties;
}

/** One link row: an author-supplied html item, or a real Docusaurus link. */
function FooterLinkRow({ item }: { item: FooterLink }): React.ReactElement {
  if (item.html) {
    return (
      <li
        className={cn("text-sm", item.className)}
        // The config author provided the HTML, as stock Docusaurus does.
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: item.html }}
      />
    );
  }
  return (
    <li>
      <LinkItem
        item={{
          ...item,
          // Colors are named here rather than left to Infima's
          // `.footer__link-item` — see the note at the top of this file.
          className: cn(
            "text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline",
            item.className,
          ),
        }}
      />
    </li>
  );
}

function FooterColumns({
  columns,
}: {
  columns: FooterColumn[];
}): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-8 text-sm md:grid-cols-3 lg:grid-cols-4">
      {columns.map((column, i) => (
        <div
          key={i}
          className={cn(
            ThemeClassNames.layout.footer.column,
            "flex flex-col gap-2",
            column.className,
          )}
        >
          {column.title && (
            <div className="mb-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {column.title}
            </div>
          )}
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {column.items.map((item, j) => (
              <FooterLinkRow key={j} item={item} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FooterRow({ links }: { links: FooterLink[] }): React.ReactElement {
  return (
    <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-x-6 gap-y-2 p-0">
      {links.map((item, i) => (
        <FooterLinkRow key={i} item={item} />
      ))}
    </ul>
  );
}

function FooterLogoImage({ logo }: { logo: FooterLogo }): React.ReactElement {
  const sources = {
    light: useBaseUrl(logo.src),
    dark: useBaseUrl(logo.srcDark || logo.src),
  };
  const image = (
    <ThemedImage
      sources={sources}
      alt={logo.alt ?? ""}
      width={logo.width}
      height={logo.height}
      style={logo.style}
      className="max-h-10 w-auto"
    />
  );
  return logo.href ? (
    <a
      href={logo.href}
      target={logo.target ?? "_self"}
      rel={logo.target === "_blank" ? "noopener noreferrer" : undefined}
      className="inline-flex hover:no-underline"
    >
      {image}
    </a>
  ) : (
    image
  );
}

export default function Footer(): React.ReactElement | null {
  const { footer } = useThemeConfig();
  const { siteConfig } = useDocusaurusContext();

  // Stock behaviour: no themeConfig.footer, no footer.
  if (!footer) {
    return null;
  }

  const {
    copyright,
    links = [],
    logo,
  } = footer as {
    copyright?: string;
    links?: (FooterLink | FooterColumn)[];
    logo?: FooterLogo;
  };
  const hasLinks = links.length > 0;
  const multiColumn = hasLinks && isColumns(links);

  return (
    <footer
      className={cn(
        ThemeClassNames.layout.footer.container,
        "border-t border-border/50 bg-background px-4 pb-8 pt-14 text-foreground md:px-8",
      )}
    >
      <div className="mx-auto max-w-[1800px]">
        {/* The twelve-column split is for a footer that HAS link columns. With
            none configured — which is what a brand-new vsor site looks like —
            it laid a lone name across five columns and left seven empty, a
            214px band of nothing (found live 2026-08-14). No links, no grid:
            the brand sits on its own line above the rule. Adding a `links` key
            to themeConfig.footer brings the columns back with no other edit. */}
        {hasLinks ? (
          <div className="mb-10 grid grid-cols-1 gap-10 md:grid-cols-12">
            {/* Brand — the site's own name and, when configured, its mark */}
            <div className="flex flex-col gap-4 md:col-span-5">
              {logo && <FooterLogoImage logo={logo} />}
              <div className="text-2xl font-semibold tracking-tight">
                {siteConfig.title}
              </div>
            </div>

            <div className="md:col-span-1" />

            <div className="md:col-span-6">
              {multiColumn ? (
                <FooterColumns columns={links as FooterColumn[]} />
              ) : (
                <FooterRow links={links as FooterLink[]} />
              )}
            </div>
          </div>
        ) : (
          <div className="mb-8 flex flex-col gap-3">
            {logo && <FooterLogoImage logo={logo} />}
            <div className="text-xl font-semibold tracking-tight">
              {siteConfig.title}
            </div>
          </div>
        )}

        {copyright && (
          <div className="flex flex-col items-center justify-between gap-4 border-t border-border/40 pt-8 text-sm text-muted-foreground md:flex-row">
            <div
              className="footer__copyright"
              // The config author provided the HTML, as stock Docusaurus does.
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: copyright }}
            />
          </div>
        )}
      </div>
    </footer>
  );
}
