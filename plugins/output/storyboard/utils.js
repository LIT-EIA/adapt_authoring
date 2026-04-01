const { Paragraph, TextRun } = require("docx");

/* --- CORE UTILITIES --- */
function safeText(str) {
  if (str === null || str === undefined) return "";

  // Convert to string first
  let s = String(str);

  // --- Remove control characters (your original logic) ---
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD\u202A-\u202E]/g, "");

  // --- HTML → text conversion ---

  // Remove MS Office <o:p> tags
  s = s.replace(/<o:p>\s*<\/o:p>/gi, "");

  // Convert <br> to newlines
  s = s.replace(/<br\s*\/?>/gi, "\n");

  // Convert </p> to newlines
  s = s.replace(/<\/p>/gi, "\n");

  // Strip all remaining HTML tags
  s = s.replace(/<[^>]+>/g, "");

  // Decode a minimal set of HTML entities
  const entities = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'"
  };
  Object.keys(entities).forEach(k => {
    s = s.replace(new RegExp(k, "g"), entities[k]);
  });

  // Collapse multiple newlines
  s = s.replace(/\n\s*\n+/g, "\n\n");

  // Final trim
  return s.trim();
}

function addLabelValue(children, label, value) {
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: label + ": ", bold: true }),
        new TextRun(safeText(value) || "(none)")
      ]
    })
  );
}

module.exports = {
  safeText,
  addLabelValue
};
