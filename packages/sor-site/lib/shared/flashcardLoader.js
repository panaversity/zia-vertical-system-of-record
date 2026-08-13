/**
 * Shared flashcard YAML loader.
 * Used by: the @vsor/lib-remark-flashcards plugin (and any future consumer).
 */

const fs = require("fs");
const path = require("path");
const yaml = require("yaml");

/**
 * Load all flashcard decks from a docs directory.
 * @param {string} docsDir - Absolute path to the docs directory
 * @returns {Array<{filePath: string, deck: object}>}
 */
function loadAllDecks(docsDir) {
  // fs.readdirSync with recursive works on Node 18.17+ (covers Node 20 LTS)
  const yamlFiles = fs
    .readdirSync(docsDir, { recursive: true })
    .filter((f) => typeof f === "string" && f.endsWith(".flashcards.yaml"))
    .map((rel) => path.resolve(docsDir, rel));

  const results = [];
  const errors = [];

  for (const filePath of yamlFiles) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const deck = yaml.parse(content);
      results.push({ filePath, deck });
    } catch (err) {
      errors.push({ filePath, error: err.message });
    }
  }

  if (errors.length > 0) {
    console.error("Failed to load flashcard files:");
    for (const { filePath, error } of errors) {
      console.error(`  ${filePath}: ${error}`);
    }
    throw new Error(`Failed to load ${errors.length} flashcard file(s)`);
  }

  return results;
}

/**
 * Load a single flashcard deck co-located with an MD file.
 * @param {string} mdFilePath - Absolute path to the .md file
 * @returns {{filePath: string, deck: object} | null}
 */
function loadDeckForFile(mdFilePath) {
  // thesis.md → thesis.flashcards.yaml
  const dir = path.dirname(mdFilePath);
  const stem = path.basename(mdFilePath, path.extname(mdFilePath));
  const yamlPath = path.join(dir, `${stem}.flashcards.yaml`);

  if (!fs.existsSync(yamlPath)) {
    return null;
  }

  const content = fs.readFileSync(yamlPath, "utf-8");
  let deck;
  try {
    deck = yaml.parse(content);
  } catch (err) {
    throw new Error(`Failed to parse YAML in ${yamlPath}: ${err.message}`);
  }
  return { filePath: yamlPath, deck };
}

module.exports = { loadAllDecks, loadDeckForFile };
