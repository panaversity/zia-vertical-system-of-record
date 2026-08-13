/**
 * Mounts the headless ImageZoom once for the whole site — upstream mounts it
 * from its own src/theme/Root.tsx at d764f334; a theme entry is the same seam.
 * A consuming site that swizzles Root in site/src/theme/ takes precedence and
 * should re-mount <ImageZoom /> itself.
 */
import React from "react";
import ImageZoom from "../components/ImageZoom";

export default function Root({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <ImageZoom />
      {children}
    </>
  );
}
