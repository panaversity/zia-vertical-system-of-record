/**
 * `cn` — the one helper every shadcn component imports.
 *
 * Copied from ag2 apps/learn-app at d764f334 (src/lib/utils.ts). clsx resolves
 * conditional class lists; tailwind-merge then drops the loser of any conflicting
 * pair (`px-2 px-4` -> `px-4`), which is what makes `className` overrides on a
 * shadcn component behave the way callers expect.
 *
 * Canonical shadcn, deliberately: an agent that has seen shadcn has seen this file.
 */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
