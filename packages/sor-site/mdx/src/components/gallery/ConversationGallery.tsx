/**
 * ConversationGallery — extracted from ag2/apps/learn-app/src/components/
 * gallery/ConversationGallery.tsx at d764f334.
 *
 * Strip against upstream: framer-motion (not on the surface spec's dependency
 * allowlist). The AnimatePresence height animation became a plain conditional
 * render with a CSS expand animation in Gallery.module.css — look changed,
 * contract identical.
 */
import React, { useState, useMemo } from "react";
import type { ConversationGalleryProps, GalleryConversation } from "./types";
import ConversationCard from "./ConversationCard";
import ComparisonView from "./ComparisonView";
import styles from "./Gallery.module.css";

type ViewMode = "gallery" | "compare";

function findByQuality(
  conversations: GalleryConversation[],
  quality: "strong" | "weak",
): GalleryConversation | undefined {
  return conversations.find((c) => c.label.toLowerCase().startsWith(quality));
}

export default function ConversationGallery({
  gallery,
}: ConversationGalleryProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ViewMode>("gallery");

  const conversations = gallery?.gallery?.conversations ?? [];

  const strong = useMemo(
    () => findByQuality(conversations, "strong"),
    [conversations],
  );
  const weak = useMemo(
    () => findByQuality(conversations, "weak"),
    [conversations],
  );
  const canCompare = Boolean(strong && weak);

  if (conversations.length === 0) {
    return null;
  }

  return (
    <div className={styles.galleryRoot}>
      <button
        className={styles.galleryTrigger}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        type="button"
      >
        <span className={styles.galleryTriggerIcon} aria-hidden>
          {open ? "▲" : "▼"}
        </span>
        <span className={styles.galleryTriggerText}>
          See how others approached this exercise
        </span>
        <span className={styles.galleryCount}>
          {conversations.length} example{conversations.length !== 1 ? "s" : ""}
        </span>
      </button>

      {open && (
        <div className={styles.galleryContent}>
          {canCompare && (
            <div className={styles.viewTabs}>
              <button
                className={`${styles.viewTab} ${view === "gallery" ? styles.viewTabActive : ""}`}
                onClick={() => setView("gallery")}
                type="button"
              >
                All Examples
              </button>
              <button
                className={`${styles.viewTab} ${view === "compare" ? styles.viewTabActive : ""}`}
                onClick={() => setView("compare")}
                type="button"
              >
                Compare Strong vs Weak
              </button>
            </div>
          )}

          {view === "gallery" && (
            <div className={styles.cardList}>
              {conversations.map((conv) => (
                <ConversationCard key={conv.id} conversation={conv} />
              ))}
            </div>
          )}

          {view === "compare" && strong && weak && (
            <ComparisonView strong={strong} weak={weak} />
          )}
        </div>
      )}
    </div>
  );
}
