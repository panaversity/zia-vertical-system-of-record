// This homepage is yours — a plain Docusaurus page. The title comes from
// site/docusaurus.config.ts; the knowledge itself lives in ../knowledge.
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import type { ReactNode } from "react";

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout>
      <main style={{ textAlign: "center", padding: "6rem 1rem" }}>
        <h1>{siteConfig.title}</h1>
        <Link className="button button--primary button--lg" to="/docs/example">
          Read the knowledge base
        </Link>
      </main>
    </Layout>
  );
}
