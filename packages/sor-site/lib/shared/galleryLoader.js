/**
 * Shared gallery YAML loader.
 * Used by: remark-gallery plugin.
 * Pattern: identical to flashcardLoader.js
 */

const fs = require("fs");
const path = require("path");
const yaml = require("yaml");

/**
 * Load a single gallery file co-located with an MD file.
 * @param {string} mdFilePath - Absolute path to the .md file
 * @returns {{filePath: string, gallery: object} | null}
 */
function loadGalleryForFile(mdFilePath) {
  const dir = path.dirname(mdFilePath);
  const stem = path.basename(mdFilePath, path.extname(mdFilePath));
  const yamlPath = path.join(dir, `${stem}.gallery.yaml`);

  if (!fs.existsSync(yamlPath)) {
    return null;
  }

  const content = fs.readFileSync(yamlPath, "utf-8");
  let gallery;
  try {
    gallery = yaml.parse(content);
  } catch (err) {
    throw new Error(`Failed to parse YAML in ${yamlPath}: ${err.message}`);
  }
  return { filePath: yamlPath, gallery };
}

module.exports = { loadGalleryForFile };
