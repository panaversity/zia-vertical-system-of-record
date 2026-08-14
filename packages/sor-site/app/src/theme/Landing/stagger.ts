/**
 * The entrance stagger, as data.
 *
 * `styles.rise` (styles.module.css) delays itself by `--step * 90ms`, so a
 * component says WHERE a thing is in the sequence and never how long to wait.
 * Upstream carried the same idea as one hand-written delay class per position
 * (`delay-100` … `delay-500`), which caps the sequence at five and cannot be
 * driven by a corpus that supplies its own number of cards.
 */
import type { CSSProperties } from "react";

export function step(n: number): CSSProperties {
  return { "--step": n } as CSSProperties;
}
