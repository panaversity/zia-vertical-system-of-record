/**
 * Navbar — the site's top chrome. A full swizzle of Docusaurus's @theme/Navbar
 * (not a wrap): the bar is laid out here, so the surface spec's seam-liveness
 * acceptance (B12) is load-bearing rather than theoretical.
 *
 * Copied from ag2 apps/learn-app src/theme/Navbar/index.tsx at d764f334 and
 * reworked on the way across. What crossed: the glass/scroll header, the mobile
 * sheet menu with the doc tree inside it, the search and color-mode mounts, the
 * sticky behaviour. What did not (all excluded by the surface spec's negative
 * contract; the identifiers are deliberately not spelled out here because the
 * boundary test scans this source for them): the sign-in control and its
 * account menu, the language switcher, the read-aloud button and the context it
 * consumed, the updates badge with its unseen-count hook, the ranking link, and
 * the i18n-aware route matching.
 *
 * CONTENT-DRIVEN, where upstream was brand-driven. Upstream hardcoded its own
 * title, its own logo mark and a fixed three-link set. Here:
 *   - title + logo come from @theme/Logo, i.e. from siteConfig.title and
 *     themeConfig.navbar.{title,logo} — including srcDark, alt, href, target;
 *   - every link comes from themeConfig.navbar.items (see ./items);
 *   - nothing in this file names a project, a product or a corpus.
 *
 * Class names are written out in full, never composed from a variable: Tailwind
 * scans source text for complete class strings, so `${bp}:flex` would compile
 * to nothing at all and fail silently at a viewport nobody tests.
 *
 * SSR discipline (found live 2026-08-13 in this package, see ./useModKey):
 * Node defines a global `navigator`, so `typeof`-guards around platform state
 * are dead code during the server render. Everything here that depends on the
 * browser — the scroll state, the open sheet — starts at its SSR value and only
 * changes after mount, so the server HTML and the first client render agree.
 *
 * The desktop/mobile switch is `min-[997px]`, an arbitrary variant rather than
 * a named screen so this component needs no custom breakpoint registered:
 * Docusaurus swaps its own doc sidebar between mobile and desktop at the same
 * pixel (theme-common useWindowSize — mobile is width <= 996), so the hamburger
 * appears exactly when the sidebar goes mobile.
 */

import React, { useEffect, useState } from "react";
import { useLocation } from "@docusaurus/router";
import { useThemeConfig } from "@docusaurus/theme-common";
import {
  useNavbarMobileSidebar,
  useNavbarSecondaryMenu,
} from "@docusaurus/theme-common/internal";
import Logo from "@theme/Logo";
import { SearchBar } from "@/components/SearchBar";
import { ModeToggle } from "@/components/ModeToggle";
import { Menu, X } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  NavbarLinks,
  NavbarLinksMobile,
  isRight,
  type ThemeNavbarItem,
} from "./items";

export default function Navbar(): React.ReactElement {
  const { navbar } = useThemeConfig();
  const items = (navbar?.items ?? []) as ThemeNavbarItem[];
  const location = useLocation();
  const secondaryMenu = useNavbarSecondaryMenu();
  const mobileSidebar = useNavbarMobileSidebar();

  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // The doc tree, teleported into the mobile sheet by Docusaurus itself
  // (theme-classic DocSidebar/Mobile fills the secondary menu). Its presence IS
  // the doc-page signal at mobile width — no route regex to keep in sync with
  // the corpus's routeBasePath.
  const docTree = secondaryMenu.content;

  // Glass intensity follows the scroll position. Read once on mount too: a page
  // opened at an anchor is already scrolled, and upstream's listener-only
  // version painted such a page as if it were at the top.
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the sheet when the route actually changes (a link inside the doc tree
  // navigates without any of our own handlers running).
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // This navbar renders its own sheet and never mounts Docusaurus's mobile
  // sidebar, so that sidebar's `shown` flag must stay false. It does not on its
  // own: the doc tree's item handler toggles it on every tap (theme-classic
  // DocSidebar/Mobile onItemClick), and while it reads true the navbar provider
  // registers a history blocker that swallows the reader's next Back press
  // (theme-common navbarMobileSidebar: `value.shown && <OnHistoryPop …>`).
  // Pinning it closed here keeps the browser's Back button honest.
  useEffect(() => {
    if (mobileSidebar.shown) {
      mobileSidebar.toggle();
    }
  }, [mobileSidebar.shown, mobileSidebar.toggle]);

  const leftItems = items.filter((item) => !isRight(item));
  const rightItems = items.filter(isRight);

  return (
    // The outer <nav> keeps Docusaurus's own classes so the framework's layout
    // math (sticky offset, print rules) still applies, with infima's bar
    // painting reset to nothing: the <header> below is the bar.
    // `!z-40` is load-bearing, not decoration: Infima gives `.navbar--fixed-top`
    // z-index 200 (--ifm-z-index-fixed), which is above the mobile sheet's
    // portal at z-50 — the bar then paints OVER the open sheet and eats its
    // header row. Found live 2026-08-14 at 375px, by looking at the sheet.
    <nav className="navbar navbar--fixed-top !z-40 !m-0 !block !h-auto !min-h-0 !border-none !bg-transparent !p-0 !shadow-none">
      <header
        className={cn(
          "sticky top-0 z-40 w-full border-b transition-all duration-300",
          isScrolled
            ? "border-border bg-background/95 shadow-sm backdrop-blur-xl"
            : "border-border/50 bg-background",
        )}
      >
        <div className="mx-auto flex h-[var(--ifm-navbar-height)] max-w-[1800px] items-center justify-between gap-2 px-4">
          {/* LEFT — brand, then the items configured for the left side */}
          <div className="flex shrink-0 items-center gap-3">
            {/* Color lives on the anchor, not the title, so the whole brand
                (mark included) responds to one hover. It is named twice on
                purpose — `navbar__brand` and the token utility — because which
                of the two wins depends on whether the build emulates CSS
                `@layer` (found live 2026-08-14: with emulation, Tailwind's
                boosted preflight `a { color: inherit }` beats Infima; without
                it, Infima's unlayered rules beat every utility, and a brand
                with only utilities came out link-coloured). Both routes land on
                the same token, so the bar looks the same either way. */}
            <Logo
              className="navbar__brand flex items-center gap-2 text-foreground transition-colors hover:text-primary hover:no-underline"
              imageClassName="flex items-center [&_img]:max-h-8 [&_img]:w-auto"
              titleClassName="navbar__title text-base font-bold tracking-tight sm:text-lg md:text-xl"
            />
            <NavbarLinks items={leftItems} className="hidden min-[997px]:flex" />
          </div>

          {/* CENTER — deliberately empty. A wide search field in the middle of
              the bar reads as a web-app chrome, not a publication's masthead;
              upstream's bar carries none either. Search lives in the right
              cluster as an icon (and on ⌘K), which keeps it one click away
              without spending the bar's centre on it. */}
          <div className="hidden flex-1 min-[997px]:flex" />

          {/* RIGHT — configured right-side items, search, color mode, mobile trigger */}
          <div className="flex shrink-0 items-center gap-1">
            <NavbarLinks items={rightItems} className="hidden min-[997px]:flex" />
            <div className="hidden min-[997px]:block">
              <SearchBar compact />
            </div>
            <div className="hidden min-[997px]:block">
              <ModeToggle />
            </div>

            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-[997px]:hidden [&_svg]:size-5"
                >
                  <Menu aria-hidden="true" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                hideCloseButton
                className="flex w-[300px] flex-col gap-0 overflow-hidden p-0 sm:w-[350px]"
              >
                <SheetHeader className="flex h-12 shrink-0 flex-row items-center gap-1 space-y-0 border-b border-border pl-4 pr-2">
                  <SheetTitle className="min-w-0 flex-1 truncate text-left text-sm font-semibold">
                    {docTree ? "Contents" : "Menu"}
                  </SheetTitle>
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="-mr-1 h-9 w-9 text-muted-foreground"
                    >
                      <X aria-hidden="true" />
                      <span className="sr-only">Close menu</span>
                    </Button>
                  </SheetClose>
                </SheetHeader>

                {/* Search first: on a corpus site it is the primary action.
                    The keyboard shortcut stays with the bar's own instance so
                    two mounted dialogs cannot both answer one keypress. */}
                <div className="shrink-0 border-b border-border px-3 py-2">
                  <SearchBar enableShortcut={false} />
                </div>

                <div className="flex shrink-0 items-center justify-end border-b border-border px-2 py-1.5">
                  <ModeToggle />
                </div>

                {/* Navigation body. Both halves render when both exist — the
                    configured items, then the doc tree — so a reader never has
                    to go "back" to reach the other one.

                    The click handler closes the sheet on taps that actually
                    NAVIGATE. "Has an href" is not enough: a collapsible
                    category with no page of its own is rendered by Docusaurus
                    as <a href="#" role="button" aria-expanded> with no separate
                    caret button, so treating that "#" as navigation dismissed
                    the sheet on the very tap meant to expand the group — the
                    child pages became unreachable on phones while desktop,
                    which has no sheet, looked fine. (Upstream's scar, carried
                    across with the code.) */}
                <div
                  className="flex-1 overflow-y-auto overscroll-contain p-2"
                  onClick={(e) => {
                    const link = (e.target as HTMLElement).closest("a");
                    if (!link) {
                      return;
                    }
                    const href = link.getAttribute("href");
                    const isPureToggle =
                      !href ||
                      href === "#" ||
                      link.getAttribute("role") === "button";
                    if (!isPureToggle) {
                      setMenuOpen(false);
                    }
                  }}
                >
                  <NavbarLinksMobile items={items} />
                  {docTree && (
                    <div
                      className={
                        items.length > 0
                          ? "mt-2 border-t border-border pt-2"
                          : undefined
                      }
                    >
                      {docTree}
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
    </nav>
  );
}
