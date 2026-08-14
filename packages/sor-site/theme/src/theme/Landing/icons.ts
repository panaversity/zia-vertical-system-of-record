/**
 * The resolvable icon set for content-driven config.
 *
 * Config is data — `icon: "database"` in a prop or in themeConfig is a string,
 * and a string cannot import a component. This is the named, closed set that
 * turns one into the other. It is deliberately small: sixteen icons that a
 * system of record plausibly needs, all from lucide (the icon system upstream
 * uses, and the one an agent asked to restyle a vsor site already knows).
 *
 * Adding one is a one-line change here. Importing lucide by name at runtime is
 * not an option worth having: it would pull the whole icon set into the bundle.
 */
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Database,
  FileText,
  FolderOpen,
  Globe,
  Layers,
  Library,
  Network,
  Scale,
  Server,
  Shield,
  Sparkles,
  Terminal,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const LANDING_ICONS = {
  "arrow-right": ArrowRight,
  "book-open": BookOpen,
  boxes: Boxes,
  database: Database,
  "file-text": FileText,
  "folder-open": FolderOpen,
  globe: Globe,
  layers: Layers,
  library: Library,
  network: Network,
  scale: Scale,
  server: Server,
  shield: Shield,
  sparkles: Sparkles,
  terminal: Terminal,
  workflow: Workflow,
} as const satisfies Record<string, LucideIcon>;

/** The names `icon:` accepts. Unknown names fall back, never throw. */
export type LandingIconName = keyof typeof LANDING_ICONS;

export function resolveIcon(
  name: string | undefined,
  fallback: LucideIcon,
): LucideIcon {
  if (!name) {
    return fallback;
  }
  return LANDING_ICONS[name as LandingIconName] ?? fallback;
}
