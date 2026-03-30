const htmlToText = require("html-to-text");

function cleanHTML(str) {
  if (!str) return "";
  return htmlToText.fromString(String(str), {
    wordwrap: false,
    ignoreHref: true,
    ignoreImage: true,
  }).trim();
}

function normId(id) {
  return id ? id.toString() : "";
}

function cleanPage(p) {
  return {
    id: normId(p._id),
    title: cleanHTML(p.title || ""),
    displayTitle: cleanHTML(p.displayTitle || p.title || ""),
    instruction: cleanHTML(p.instruction || ""),
    body: cleanHTML(p.body || ""),
    pageBody: cleanHTML(p.pageBody || ""),
    _graphic: p._graphic
  };
}

function cleanArticle(a) {
  return {
    id: normId(a._id),
    title: cleanHTML(a.title || ""),
    displayTitle: cleanHTML(a.displayTitle || a.title || ""),
    body: cleanHTML(a.body || ""),
    instruction: cleanHTML(a.instruction || "")
  };
}

function cleanBlock(b) {
  return {
    id: normId(b._id),
    title: cleanHTML(b.title || ""),
    displayTitle: cleanHTML(b.displayTitle || b.title || ""),
    body: cleanHTML(b.body || ""),
    instruction: cleanHTML(b.instruction || "")
  };
}

function cleanComponent(c) {
  const base = {
    ...c, // Spread original to keep nested items/characters
    id: normId(c._id),
    type: c._component || c._type,
    layout: c._layout || "full", // Added layout support
    title: cleanHTML(c.title || ""),
    displayTitle: cleanHTML(c.displayTitle || c.title || ""),
    instruction: cleanHTML(c.instruction || ""),
    body: cleanHTML(c.body || "")
  };

  if (c._items && Array.isArray(c._items)) {
    base.items = c._items.map(item => ({
      ...item,
      text: item.text ? cleanHTML(item.text) : "",
      title: item.title ? cleanHTML(item.title) : "",
    }));
  }

  return base;
}

module.exports = {
  cleanPage,
  cleanArticle,
  cleanBlock,
  cleanComponent,
  cleanHTML,
  normId
};