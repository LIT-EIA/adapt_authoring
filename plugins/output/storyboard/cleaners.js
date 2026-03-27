const htmlToText = require("html-to-text");

/* Strip HTML safely */
function cleanHTML(str) {
  if (!str) return "";
  return htmlToText.fromString(String(str), {
    wordwrap: false,
    ignoreHref: true,
    ignoreImage: true,
  }).trim();
}

/* Normalize ID (handles ObjectId or string) */
function normId(id) {
  return id ? id.toString() : "";
}

/* PAGE */
function cleanPage(p) {
  return {
    id: normId(p._id),
    parentId: normId(p._parentId),
    title: cleanHTML(p.title || ""),
    displayTitle: cleanHTML(p.displayTitle || p.title || ""),
    instruction: cleanHTML(p.instruction || ""),
    body: cleanHTML(p.body || ""),
    pageBody: cleanHTML(p.pageBody || ""),
    graphic: p._graphic || null,
  };
}

/* ARTICLE */
function cleanArticle(a) {
  return {
    id: normId(a._id),
    parentId: normId(a._parentId),
    title: cleanHTML(a.title || ""),
    displayTitle: cleanHTML(a.displayTitle || a.title || ""),
    instruction: cleanHTML(a.instruction || ""),
    body: cleanHTML(a.body || ""),
  };
}

/* BLOCK */
function cleanBlock(b) {
  return {
    id: normId(b._id),
    parentId: normId(b._parentId),
    title: cleanHTML(b.title || ""),
    displayTitle: cleanHTML(b.displayTitle || b.title || ""),
    instruction: cleanHTML(b.instruction || ""),
    body: cleanHTML(b.body || ""),
  };
}

/* COMPONENT */
function cleanComponent(c) {
  const base = {
    id: normId(c._id),
    parentId: normId(c._parentId),
    type: c._component || c._type,
    title: cleanHTML(c.title || ""),
    displayTitle: cleanHTML(c.displayTitle || c.title || ""),
    instruction: cleanHTML(c.instruction || ""),
    body: cleanHTML(c.body || ""),
  };

  // Add structured fields per component type
  if (c._component === "graphic" && c._graphic) {
    base.graphic = {
      alt: c._graphic.alt || "",
      large: c._graphic.large || "",
      small: c._graphic.small || "",
      attribution: cleanHTML(c._graphic.attribution || "")
    };
  }

  if (c._component === "mcq") {
    base.items = (c._items || []).map(i => ({
      text: cleanHTML(i.text || ""),
      correct: !!i._shouldBeSelected,
      feedback: cleanHTML(i.feedback || "")
    }));
  }

  return base;
}

module.exports = {
  cleanPage,
  cleanArticle,
  cleanBlock,
  cleanComponent,
  cleanHTML
};
