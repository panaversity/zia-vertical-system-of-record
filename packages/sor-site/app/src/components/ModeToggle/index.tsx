/**
 * ModeToggle — color-mode toggle.
 *
 * Audit verdict (surface spec: keep "ONLY if it is Docusaurus color-mode"):
 * KEEP. At d764f334 the upstream component's entire behaviour is
 * useColorMode() from @docusaurus/theme-common — no study-mode coupling, no
 * auth, no product state. Reworked on copy: the shadcn Button and lucide
 * Sun/Moon icons (tailwind UI kit, excluded) became a plain button with
 * inline SVGs; the light/dark swap is pure CSS on [data-theme].
 *
 * Present but unwired: the stock classic navbar already ships its own
 * color-mode toggle; this component exists at @theme/ModeToggle for custom
 * navbars and swizzles.
 */

import React from "react";
import { useColorMode } from "@docusaurus/theme-common";
import styles from "./styles.module.css";

export function ModeToggle() {
  const { colorMode, setColorMode } = useColorMode();

  const toggleTheme = () => {
    setColorMode(colorMode === "dark" ? "light" : "dark");
  };

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label="Toggle color mode"
      data-vsor="mode-toggle"
    >
      <svg
        className={styles.sun}
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>
      <svg
        className={styles.moon}
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    </button>
  );
}

export default ModeToggle;
