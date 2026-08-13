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
