/**
 * Single source of truth for site URL configuration.
 * Imported by docusaurus.config.ts and any future consumer.
 * Plain .js to avoid CJS-can't-require-TS problems.
 *
 * Branding is instance config: the consuming site sets SITE_URL/BASE_URL
 * (or overrides url/baseUrl in its own docusaurus.config). The fallback is
 * the Docusaurus scaffold placeholder, never a product domain.
 */
module.exports = {
  url: process.env.SITE_URL || "https://example.com",
  baseUrl: process.env.BASE_URL || "/",
};
