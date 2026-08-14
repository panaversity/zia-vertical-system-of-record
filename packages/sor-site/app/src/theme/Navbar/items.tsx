/**
 * Navbar items — the content-driven half of the navbar.
 *
 * Every link in the chrome comes from `themeConfig.navbar.items` in the
 * consuming site's docusaurus.config.ts. Nothing is hardcoded here: this module
 * only decides how an item LOOKS, never which items exist (Acceptance B12 —
 * seam liveness — is the enforcement).
 *
 * Rendering delegates to Docusaurus's own `@theme/NavbarItem`, so every
 * standard item shape keeps working exactly as the docs describe and as an
 * agent's training data expects: `{type: "doc", docId}`, `{type: "docSidebar",
 * sidebarId}`, `{type: "dropdown", items}`, `{to}`/`{href}` links, `html`
 * items, `position: "left" | "right"`, `className`, `activeBasePath`… The one
 * addition is an optional `icon` field naming a lucide icon (see NAV_ICONS);
 * it is consumed here and never forwarded, so it cannot land on the DOM node.
 *
 * Why an allowlist of icons rather than the whole lucide set: importing the
 * library's name→component map would pull every icon into the bundle (a static
 * site paying ~1500 icons for the two it renders). Named imports tree-shake.
 * An icon name outside the list renders no icon — a config typo must never
 * break a build.
 */

import React from "react";
import NavbarItemImpl from "@theme/NavbarItem";
import {
  Archive,
  Bookmark,
  BookMarked,
  BookOpen,
  Building2,
  Calendar,
  Clock,
  Compass,
  Database,
  ExternalLink,
  FileText,
  Files,
  Folder,
  Gavel,
  Github,
  Globe,
  GraduationCap,
  HelpCircle,
  Home,
  Info,
  Landmark,
  Layers,
  Library,
  Lightbulb,
  ListTree,
  Mail,
  Map,
  Newspaper,
  Scale,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  Stethoscope,
  Tag,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** The icon names a corpus owner may write as `icon:` on a navbar item. */
export const NAV_ICONS: Record<string, LucideIcon> = {
  Archive,
  Bookmark,
  BookMarked,
  BookOpen,
  Building2,
  Calendar,
  Clock,
  Compass,
  Database,
  ExternalLink,
  FileText,
  Files,
  Folder,
  Gavel,
  Github,
  Globe,
  GraduationCap,
  HelpCircle,
  Home,
  Info,
  Landmark,
  Layers,
  Library,
  Lightbulb,
  ListTree,
  Mail,
  Map,
  Newspaper,
  Scale,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  Stethoscope,
  Tag,
  Users,
  Wrench,
};

/** A themeConfig navbar item, plus this theme's optional `icon`. */
export interface ThemeNavbarItem {
  type?: string;
  label?: string;
  icon?: string;
  position?: "left" | "right";
  className?: string;
  [key: string]: unknown;
}

// @theme/NavbarItem's published prop type is the union of the standard item
// shapes with a string `label`; this theme passes a decorated label node, which
// NavbarNavLink renders as children either way (theme-classic
// NavbarItem/NavbarNavLink at 3.10.2). One cast, stated once, here.
const NavbarItem = NavbarItemImpl as unknown as React.ComponentType<
  Record<string, unknown>
>;

export function isRight(item: ThemeNavbarItem): boolean {
  return item.position === "right";
}

/**
 * One navbar item. `mobile` switches Docusaurus's own desktop/mobile item
 * rendering: desktop items are `navbar__item navbar__link`, mobile items are
 * `menu__link` inside an `<li>` — the same markup the doc tree uses in the
 * mobile sheet, so both halves of that sheet look like one menu.
 */
export function NavbarLink({
  item,
  mobile = false,
}: {
  item: ThemeNavbarItem;
  mobile?: boolean;
}): React.ReactElement {
  const { icon, label, className, ...rest } = item;
  const Icon = icon ? NAV_ICONS[icon] : undefined;
  const content =
    Icon && label !== undefined ? (
      <span className="inline-flex items-center gap-1.5">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {label}
      </span>
    ) : (
      label
    );

  return (
    <NavbarItem
      {...rest}
      mobile={mobile}
      label={content}
      className={cn(
        // Mobile items carry layout only, no colors: in the sheet they sit
        // directly above the doc tree's own `menu__link` rows, and matching
        // those exactly is what makes the sheet read as one menu.
        //
        // Desktop items DO name their colors, and must. found live 2026-08-14:
        // Tailwind's preflight ships `a { color: inherit }`, which the build's
        // layer emulation raises above Infima's `.navbar__link` rules — so the
        // framework's own link and hover colors silently stop applying once
        // this design system is on, and an unstyled-looking bar is the result.
        // Every interactive color here is therefore explicit and token-named.
        mobile
          ? "flex items-center rounded-md text-sm font-medium"
          : // inline-flex, not Infima's block: Docusaurus appends its own
            // external-link glyph after the label, and as a block link that
            // glyph dropped onto a second line and made the bar 44px tall for
            // one item (found live 2026-08-14, an item with an `href`).
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground hover:no-underline aria-[current=page]:text-primary",
        className,
      )}
    />
  );
}

/** The desktop row of items for one side of the bar. */
export function NavbarLinks({
  items,
  className,
}: {
  items: ThemeNavbarItem[];
  className?: string;
}): React.ReactElement | null {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className={cn("items-center gap-1", className)}>
      {items.map((item, i) => (
        <NavbarLink key={i} item={item} />
      ))}
    </div>
  );
}

/** The same items as a menu list, for the mobile sheet. */
export function NavbarLinksMobile({
  items,
  className,
}: {
  items: ThemeNavbarItem[];
  className?: string;
}): React.ReactElement | null {
  if (items.length === 0) {
    return null;
  }
  return (
    <ul className={cn("menu__list", className)}>
      {items.map((item, i) => (
        <NavbarLink key={i} item={item} mobile />
      ))}
    </ul>
  );
}
