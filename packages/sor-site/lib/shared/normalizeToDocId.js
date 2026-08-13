/**
 * Normalize a file path to match Docusaurus doc ID format.
 * Strips numeric prefixes (e.g., "01-") from each path segment.
 *
 * Example:
 * - Input:  "01-Introducing-AI/01-revolution/08-gaps"
 * - Output: "Introducing-AI/revolution/gaps"
 */
function normalizeToDocId(filePath) {
  return filePath
    .split("/")
    .map((segment) => segment.replace(/^\d+-/, ""))
    .join("/");
}

module.exports = normalizeToDocId;
