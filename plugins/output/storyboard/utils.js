const { Paragraph, TextRun } = require("docx");

/* --- CORE UTILITIES --- */
function safeText(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD\u202A-\u202E]/g, "")
    .trim();
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
