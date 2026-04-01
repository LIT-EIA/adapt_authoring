const { Paragraph, TextRun } = require("docx");

/* --- CORE UTILITIES --- */
function safeText(str) {
  if (str === null || str === undefined) return "";

  let s = String(str);

  // Remove control characters
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD\u202A-\u202E]/g, "");

  // Remove MS Office <o:p> tags
  s = s.replace(/<o:p>\s*<\/o:p>/gi, "");

  // Convert <br> to newlines
  s = s.replace(/<br\s*\/?>/gi, "\n");

  // Convert </p> to newlines
  s = s.replace(/<\/p>/gi, "\n");

  // Strip all remaining HTML tags
  s = s.replace(/<[^>]+>/g, "");

  // Decode minimal HTML entities
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

/* --- HTML → TEXT (for GMCQ, MCQ, etc.) --- */
function htmlToText(html) {
  return safeText(html || "");
}

function resolveAssetRef(rel, assetMap) {
  if (!rel) return "";

  // If rel is already a path like "course/assets/abc.png"
  if (rel.includes("/") || rel.includes("\\")) {
    return rel;
  }

  // Otherwise treat rel as an asset ID or filename
  const asset = Object.values(assetMap).find(a =>
    a._id === rel || a.filename === rel
  );

  if (!asset) return rel;

  // Return normalized path
  return asset.path.replace(/\\/g, "/");
}

function renderStandardQuestionFeedback(children, comp) {
  const fb = comp._feedback || {};
  if (!fb || typeof fb !== "object") return;

  const corr = htmlToText(fb.correct || "");

  const inc = fb._incorrect || {};
  const pc = fb._partlyCorrect || {};

  const incFinal = htmlToText(inc.final || "");
  const incNotFinal = htmlToText(inc.notFinal || "");
  const pcFinal = htmlToText(pc.final || "");
  const pcNotFinal = htmlToText(pc.notFinal || "");

  addLabelValue(children, "Feedback (correct)", corr || "(none)");
  addLabelValue(children, "Feedback (incorrect - final)", incFinal || "(none)");

  if (incNotFinal) {
    addLabelValue(children, "Feedback (incorrect - not final)", incNotFinal);
  }
  if (pcFinal) {
    addLabelValue(children, "Feedback (partly correct - final)", pcFinal);
  }
  if (pcNotFinal) {
    addLabelValue(children, "Feedback (partly correct - not final)", pcNotFinal);
  }

  children.push(new Paragraph({ text: "" }));
}

module.exports = {
  safeText,
  addLabelValue,
  htmlToText,
  resolveAssetRef,
  renderStandardQuestionFeedback
};
