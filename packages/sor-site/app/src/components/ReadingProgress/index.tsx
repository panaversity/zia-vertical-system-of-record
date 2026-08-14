/**
 * ReadingProgress — local scroll indicator. No backend, content primitive
 * (explicitly kept by the surface spec's negative-contract carve-out:
 * "ReadingProgress — the local scroll indicator — stays").
 *
 * Copied from ag2 apps/learn-app src/components/ReadingProgress at d764f334.
 * Changes on copy: bar color tokenized (--vsor-reading-progress, which
 * derives from --ifm-color-primary — the B12 painted element); guarded the
 * division so a page shorter than the viewport reads 0% instead of NaN;
 * scroll listener made passive.
 */

import React, { useEffect, useState } from "react";
import styles from "./styles.module.css";

export default function ReadingProgress() {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    const update = () => {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      // found on copy: upstream divided unguarded — NaN width on pages
      // shorter than the viewport.
      setPercent(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <div className={styles.progressBarContainer} aria-hidden="true">
      <div
        className={styles.progressBar}
        data-vsor="reading-progress"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
