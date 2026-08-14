/**
 * ConversationCard — extracted from ag2/apps/learn-app/src/components/
 * gallery/ConversationCard.tsx at d764f334, unchanged: it carried no
 * excluded imports or behavior. Provider labels (Claude/ChatGPT/...) are
 * display names for corpus-supplied data, not product branding.
 */
import React, { useState } from "react";
import type { GalleryConversation, StudentField } from "./types";
import ScoreVisualization from "./ScoreVisualization";
import styles from "./Gallery.module.css";

interface TextSegment {
  text: string;
  isStudentContent: boolean;
  label?: string;
}

export function parseStudentContent(
  input: string,
  fields?: StudentField[],
): TextSegment[] {
  if (!fields || fields.length === 0) {
    return [{ text: input, isStudentContent: false }];
  }

  const segments: TextSegment[] = [];
  let remaining = input;

  // Build a combined regex that matches any field's start_marker
  // Process the string left-to-right, finding the earliest marker each iteration
  while (remaining.length > 0) {
    let earliestIdx = Infinity;
    let earliestField: StudentField | null = null;

    for (const field of fields) {
      const idx = remaining.indexOf(field.start_marker);
      if (idx !== -1 && idx < earliestIdx) {
        earliestIdx = idx;
        earliestField = field;
      }
    }

    if (!earliestField || earliestIdx === Infinity) {
      // No more markers found
      segments.push({ text: remaining, isStudentContent: false });
      break;
    }

    // Push text before the marker
    if (earliestIdx > 0) {
      segments.push({
        text: remaining.slice(0, earliestIdx),
        isStudentContent: false,
      });
    }

    // Find the end of the marked span
    const afterStart = earliestIdx + earliestField.start_marker.length;
    const endMarker = earliestField.end_marker ?? earliestField.start_marker;
    const endIdx = remaining.indexOf(endMarker, afterStart);

    if (endIdx === -1) {
      // No closing marker: treat the rest as the marked span
      segments.push({
        text: remaining.slice(afterStart),
        isStudentContent: true,
        label: earliestField.name,
      });
      break;
    }

    segments.push({
      text: remaining.slice(afterStart, endIdx),
      isStudentContent: true,
      label: earliestField.name,
    });

    remaining = remaining.slice(endIdx + endMarker.length);
  }

  return segments.length > 0
    ? segments
    : [{ text: input, isStudentContent: false }];
}

function providerBadge(provider: string) {
  const normalized = provider.toLowerCase();
  const labels: Record<string, string> = {
    claude: "Claude",
    chatgpt: "ChatGPT",
    gemini: "Gemini",
    copilot: "Copilot",
  };
  return labels[normalized] ?? provider;
}

function qualityBadge(label: string) {
  const lower = label.toLowerCase();
  if (lower.startsWith("strong")) return "strong";
  if (lower.startsWith("weak")) return "weak";
  return "neutral";
}

interface ConversationCardProps {
  conversation: GalleryConversation;
  defaultExpanded?: boolean;
}

export default function ConversationCard({
  conversation,
  defaultExpanded = false,
}: ConversationCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const quality = qualityBadge(conversation.label);

  return (
    <div className={`${styles.convCard} ${styles[`convCard_${quality}`]}`}>
      <button
        className={styles.convCardHeader}
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        type="button"
      >
        <div className={styles.convCardBadges}>
          <span className={`${styles.qualityBadge} ${styles[`badge_${quality}`]}`}>
            {conversation.label}
          </span>
          <span className={styles.providerBadge}>
            {providerBadge(conversation.provider)}
          </span>
        </div>
        <span className={styles.convCardChevron} aria-hidden>
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div className={styles.convCardBody}>
          <div className={styles.convSection}>
            <div className={styles.convSectionLabel}>Prompt</div>
            <div className={styles.convSectionContent}>
              {parseStudentContent(
                conversation.student_input,
                conversation.student_fields,
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
          </div>

          <div className={styles.convSection}>
            <div className={styles.convSectionLabel}>AI Response</div>
            <div className={styles.convSectionContent}>
              {conversation.ai_output}
            </div>
          </div>

          <ScoreVisualization scores={conversation.scores} />

          {conversation.commentary && (
            <div className={styles.commentary}>
              <div className={styles.commentaryLabel}>What to notice</div>
              <p className={styles.commentaryText}>{conversation.commentary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
