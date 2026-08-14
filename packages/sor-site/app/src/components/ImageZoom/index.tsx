/**
 * ImageZoom
 *
 * Click-to-enlarge for every image inside rendered lesson content: opens the
 * image fit-to-screen, then lets the reader zoom past 100% and pan around.
 * Headless — renders nothing, mounted once from src/theme/Root.tsx.
 *
 * Zoom-and-pan rather than a plain fit-to-screen lightbox because the book's
 * tall infographics (some are 2720x3520) are already taller than a laptop
 * screen. Fitting them to the viewport barely enlarges them; the reader has to
 * be able to push past the fit and move around to actually read them.
 *
 * Mounted at the Root rather than swizzling @theme/MDXComponents/Img so it also
 * covers <img> rendered by MDX components, which never pass through the MDX
 * `img` mapping.
 */

import { useEffect } from "react";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";

/** Rendered doc/lesson body — markdown images and MDX-component images alike. */
const CONTENT_IMAGES = ".markdown img";

/**
 * A linked image belongs to its link, and anything under data-no-zoom has
 * opted out. Everything else in the content body is zoomable.
 */
function isZoomable(img: HTMLImageElement): boolean {
  return (
    img.matches(CONTENT_IMAGES) &&
    !img.closest("a") &&
    !img.closest("[data-no-zoom]")
  );
}

export default function ImageZoom(): null {
  useEffect(() => {
    const lightbox = new PhotoSwipeLightbox({
      // Core (~30KB) is only fetched once a reader actually opens an image.
      pswpModule: () => import("photoswipe"),
      bgOpacity: 0.95,
      padding: { top: 24, bottom: 24, left: 24, right: 24 },
      // Scroll wheel zooms instead of scrolling the gallery.
      wheelToZoom: true,
      // One image at a time — no gallery chrome.
      arrowPrev: false,
      arrowNext: false,
      counter: false,
      loop: false,
      mainClass: "vsor-image-zoom",
    });
    lightbox.init();

    // PhotoSwipe reads `element` to animate the open/close from the thumbnail
    // and to size the placeholder, so the slide is built per click.
    const open = (img: HTMLImageElement) => {
      const rect = img.getBoundingClientRect();
      const src = img.currentSrc || img.src;
      lightbox.options.dataSource = [
        {
          element: img,
          src,
          // Reuse the already-decoded image so the zoom starts instantly.
          msrc: src,
          width: img.naturalWidth || Math.round(rect.width),
          height: img.naturalHeight || Math.round(rect.height),
          alt: img.alt,
        },
      ];
      lightbox.loadAndOpen(0);
    };

    const onClick = (event: MouseEvent) => {
      // Let modified clicks (open in new tab, etc.) behave normally.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const img = event.target;
      if (!(img instanceof HTMLImageElement) || !isZoomable(img)) return;
      event.preventDefault();
      open(img);
    };

    // Images are not focusable by default, so without this the zoom would be
    // mouse-only.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const img = event.target;
      if (!(img instanceof HTMLImageElement) || !isZoomable(img)) return;
      event.preventDefault();
      open(img);
    };

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);

    // Route changes, tabs, <details>, and lazily-rendered components all add
    // images after mount, so keep marking new ones as focusable.
    let frame = 0;
    const markFocusable = () => {
      document
        .querySelectorAll<HTMLImageElement>(CONTENT_IMAGES)
        .forEach((img) => {
          if (isZoomable(img) && !img.hasAttribute("tabindex")) {
            img.tabIndex = 0;
          }
        });
    };
    const scheduleMark = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        markFocusable();
      });
    };

    const addedAnImage = (nodes: NodeList) =>
      Array.from(nodes).some(
        (node) =>
          node instanceof HTMLElement &&
          (node.tagName === "IMG" || node.querySelector("img") !== null),
      );

    const observer = new MutationObserver((records) => {
      if (records.some((record) => addedAnImage(record.addedNodes))) {
        scheduleMark();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    markFocusable();

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
      lightbox.destroy();
    };
  }, []);

  return null;
}
