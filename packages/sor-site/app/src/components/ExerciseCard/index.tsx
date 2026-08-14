/**
 * ExerciseCard — extracted from ag2/apps/learn-app/src/components/
 * ExerciseCard/index.tsx at d764f334.
 *
 * Strips against upstream (surface spec negative contract):
 *   - the practice context hook and the `practiceEnabled` site-config gate
 *     (practice & simulation excluded, product config excluded)
 *   - the "Start" button that opened the practice terminal
 * Upstream rendered nothing unless the practice product was enabled; here the
 * card itself — the exercise marker with its id badge and title — always
 * renders, since that is the corpus-facing part of the primitive.
 * Upstream styled via global doc-pages.css classes; those rules moved into a
 * scoped CSS module, tokenized (token discipline: no raw color literals).
 *
 * Props contract IDENTICAL to upstream: { id, title }.
 */
import React from "react";
import styles from "./ExerciseCard.module.css";

export interface ExerciseCardProps {
  id: string;
  title: string;
}

export default function ExerciseCard({ id, title }: ExerciseCardProps) {
  return (
    <div className={styles.exerciseCard} id={`exercise-${id}`}>
      <div className={styles.exerciseCardLeft}>
        <span className={styles.exerciseCardBadge}>{id}</span>
        <span className={styles.exerciseCardTitle}>{title}</span>
      </div>
    </div>
  );
}
