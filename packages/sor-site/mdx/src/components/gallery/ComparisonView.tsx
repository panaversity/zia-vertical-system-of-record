/**
 * ComparisonView — extracted from ag2/apps/learn-app/src/components/gallery/
 * ComparisonView.tsx at d764f334, unchanged: no excluded imports or behavior.
 */
import React from "react";
import type { GalleryConversation } from "./types";
import { parseStudentContent } from "./ConversationCard";
import ScoreVisualization from "./ScoreVisualization";
import styles from "./Gallery.module.css";

interface ComparisonViewProps {
  strong: GalleryConversation;
  weak: GalleryConversation;
}

export default function ComparisonView({ strong, weak }: ComparisonViewProps) {
  return (
    <div className={styles.comparison}>
      <div className={styles.comparisonHeader}>Side-by-Side Comparison</div>
      <div className={styles.comparisonGrid}>
        {/* Strong prompt */}
        <div className={styles.comparisonCol}>
          <div className={`${styles.comparisonColLabel} ${styles.badge_strong}`}>
            Strong Prompt
          </div>
          <div className={styles.comparisonPrompt}>
            {parseStudentContent(
              strong.student_input,
              strong.student_fields,
            ).map((seg, i) =>
              seg.isStudentContent ? (
                <span key={i} className={styles.studentHighlight}>
                  <span className={styles.studentHighlightLabel}>
                    {seg.label ?? "Input"}
                  </span>
                  {seg.text}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </div>
          <ScoreVisualization scores={strong.scores} compact />
          {strong.commentary && (
            <div className={styles.comparisonNote}>{strong.commentary}</div>
          )}
        </div>

        {/* Weak prompt */}
        <div className={styles.comparisonCol}>
          <div className={`${styles.comparisonColLabel} ${styles.badge_weak}`}>
            Weak Prompt
          </div>
          <div className={styles.comparisonPrompt}>
            {parseStudentContent(
              weak.student_input,
              weak.student_fields,
            ).map((seg, i) =>
              seg.isStudentContent ? (
                <span key={i} className={styles.studentHighlight}>
                  <span className={styles.studentHighlightLabel}>
                    {seg.label ?? "Input"}
                  </span>
                  {seg.text}
                </span>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </div>
          <ScoreVisualization scores={weak.scores} compact />
          {weak.commentary && (
            <div className={styles.comparisonNote}>{weak.commentary}</div>
          )}
        </div>
      </div>
    </div>
  );
}
