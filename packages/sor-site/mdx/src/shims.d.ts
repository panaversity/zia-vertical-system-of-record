/**
 * Ambient declarations for Docusaurus theme/webpack aliases that only exist
 * inside a site build, plus minimal typings for the two runtime deps so this
 * package typechecks standalone without their full type graphs. Runtime
 * resolution is webpack's, inside the consuming Docusaurus site.
 */

declare module "@theme-init/MDXComponents" {
  const MDXComponents: Record<string, unknown>;
  export default MDXComponents;
}

declare module "@theme/Tabs" {
  import type * as React from "react";
  const Tabs: React.ComponentType<Record<string, unknown>>;
  export default Tabs;
}

declare module "@theme/TabItem" {
  import type * as React from "react";
  const TabItem: React.ComponentType<Record<string, unknown>>;
  export default TabItem;
}

declare module "@docusaurus/BrowserOnly" {
  import type * as React from "react";
  export default function BrowserOnly(props: {
    children: () => React.ReactNode;
    fallback?: React.ReactElement;
  }): React.ReactElement | null;
}

declare module "react-markdown" {
  import type * as React from "react";
  interface MarkdownProps {
    children?: string;
    components?: Record<string, React.ElementType>;
  }
  const Markdown: React.ComponentType<MarkdownProps>;
  export default Markdown;
}

declare module "photoswipe/lightbox" {
  export default class PhotoSwipeLightbox {
    constructor(options: Record<string, unknown>);
    options: { dataSource?: unknown } & Record<string, unknown>;
    init(): void;
    destroy(): void;
    loadAndOpen(index: number): void;
  }
}

declare module "photoswipe/style.css";

declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
