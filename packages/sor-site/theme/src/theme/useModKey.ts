/**
 * useModKey — the keyboard-shortcut modifier label: "⌘" on Apple platforms,
 * "Ctrl" everywhere else, as CLIENT-ONLY state shared by DocPageActions and
 * SearchBar.
 *
 * found live (2026-08-13): both components originally computed this at render
 * time from `navigator`, guarded by `typeof navigator !== "undefined"`. Node
 * >= 21 defines a global `navigator` (userAgent "Node.js/24", platform
 * "MacIntel" on a Mac build host), so the guard is dead during SSR: the server
 * baked the BUILD MACHINE's platform into the HTML (built output differed by
 * build host, against the reproducibility invariant), and every reader whose
 * platform differed from the build host's hydrated mismatched kbd text —
 * React minified error #418 (console.error) on every themed doc page. SSR and
 * the first client render now always agree on "Ctrl"; Apple platforms switch
 * to "⌘" in an effect after hydration, which React permits.
 */
import { useEffect, useState } from "react";

export function useModKey(): string {
  const [modKey, setModKey] = useState("Ctrl");
  useEffect(() => {
    if (/Mac|iPod|iPhone|iPad/.test(navigator.userAgent)) {
      setModKey("⌘");
    }
  }, []);
  return modKey;
}
