/**
 * Shared loaders and helpers for the sor-site content pipeline.
 *
 * Copied from ag2 libs/docusaurus/shared at d764f334, de-branded.
 */
const siteConfig = require("./siteConfig");
const normalizeToDocId = require("./normalizeToDocId");
const { loadAllDecks, loadDeckForFile } = require("./flashcardLoader");
const { loadGalleryForFile } = require("./galleryLoader");

module.exports = {
  siteConfig,
  normalizeToDocId,
  loadAllDecks,
  loadDeckForFile,
  loadGalleryForFile,
};
