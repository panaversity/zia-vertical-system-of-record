/**
 * ScoreVisualization — extracted from ag2/apps/learn-app/src/components/
 * gallery/ScoreVisualization.tsx at d764f334, unchanged: it already consumed
 * --ifm tokens for its only colors.
 */
import React from "react";
import type { GalleryScores } from "./types";
import styles from "./Gallery.module.css";

const DIMENSIONS = [
  { key: "independent_thinking" as const, label: "Independent Thinking" },
  { key: "critical_evaluation" as const, label: "Critical Evaluation" },
  { key: "reasoning_depth" as const, label: "Reasoning Depth" },
  { key: "originality" as const, label: "Originality" },
  { key: "self_awareness" as const, label: "Self-Awareness" },
];

function scoreColor(val: number): string {
  if (val >= 7) return "var(--ifm-color-success)";
  if (val >= 5) return "var(--ifm-color-warning)";
  return "var(--ifm-color-danger)";
}

interface ScoreVisualizationProps {
  scores: GalleryScores;
  compact?: boolean;
}

export default function ScoreVisualization({
  scores,
  compact = false,
}: ScoreVisualizationProps) {
  const avg =
    DIMENSIONS.reduce((sum, { key }) => sum + (scores[key] ?? 0), 0) /
    DIMENSIONS.length;

  return (
    <div
      className={`${styles.scoreViz} ${compact ? styles.scoreVizCompact : ""}`}
      role="region"
      aria-label="Score Card"
    >
      {!compact && <div className={styles.scoreVizTitle}>Score Card</div>}
      <div className={styles.scoreVizList}>
        {DIMENSIONS.map(({ key, label }) => {
          const val = scores[key] ?? 0;
          return (
            <div key={key} className={styles.scoreVizRow}>
              <span className={styles.scoreVizDim}>{label}</span>
              <div
                className={styles.scoreVizBar}
                role="meter"
                aria-valuenow={val}
                aria-valuemin={0}
                aria-valuemax={10}
                aria-label={`${label}: ${val} out of 10`}
              >
                <div
                  className={styles.scoreVizBarFill}
                  style={{
                    width: `${val * 10}%`,
                    background: scoreColor(val),
                  }}
                />
              </div>
              <span className={styles.scoreVizVal}>{val}/10</span>
            </div>
          );
        })}
      </div>
      <div className={styles.scoreVizAvg}>
        <span>Average</span>
        <span className={styles.scoreVizAvgVal}>{avg.toFixed(1)}/10</span>
      </div>
    </div>
  );
}
