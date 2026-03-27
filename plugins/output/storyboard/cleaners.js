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
    body: cleanHTML(c.body || "")
  };

  // --- TEXT COMPONENT ---
  if (c._component === "text") {
    return base;
  }

  // --- GRAPHIC COMPONENT ---
  if (c._component === "graphic") {
    base.graphic = {
      alt: c._graphic && c._graphic.alt || "",
      large: c._graphic && c._graphic.large || "",
      small: c._graphic && c._graphic.small || "",
      attribution: cleanHTML(c._graphic && c._graphic.attribution || "")
    };
    return base;
  }

  // --- MCQ COMPONENT ---
  if (c._component === "mcq") {
    base.items = (c._items || []).map(i => ({
      text: cleanHTML(i.text || ""),
      correct: !!i._shouldBeSelected,
      feedback: cleanHTML(i.feedback || "")
    }));
    return base;
  }

  // --- DND MULTIPLE COMPONENT ---
  if (c._component === "dnd-multiple") {
    base.ariaQuestion = cleanHTML(c.ariaQuestion || "");

    base.items = (c._items || []).map(item => ({
      title: cleanHTML(item.title || ""),
      options: (item._options || []).map(opt => ({
        title: cleanHTML(opt.title || ""),
        graphic: opt._graphic
          ? {
              src: opt._graphic.src || "",
              alt: cleanHTML(opt._graphic.alt || ""),
              isBackground: !!opt._graphic.isBackground
            }
          : null
      }))
    }));

    base.feedback = {
      title: cleanHTML(c._feedback && c._feedback.title || ""),
      correct: cleanHTML(c._feedback && c._feedback.correct || ""),
      incorrect_final: cleanHTML(c._feedback && c._feedback._incorrect && c._feedback._incorrect.final || ""),
      incorrect_notFinal: cleanHTML(c._feedback && c._feedback._incorrect && c._feedback._incorrect.notFinal || ""),
      partly_final: cleanHTML(c._feedback && c._feedback._partlyCorrect && c._feedback._partlyCorrect.final || ""),
      partly_notFinal: cleanHTML(c._feedback && c._feedback._partlyCorrect && c._feedback._partlyCorrect.notFinal || "")
    };

    // Useful storyboarding fields
    base.buttons = {
      submit: cleanHTML(c._buttons && c._buttons._submit && c._buttons._submit.buttonText || ""),
      showCorrect: cleanHTML(c._buttons && c._buttons._showCorrectAnswer && c._buttons._showCorrectAnswer.buttonText || "")
    };

    base.attempts = c._attempts || 0;

    return base;
  }

  // --- DEFAULT BEHAVIOR FOR UNKNOWN COMPONENT TYPES ---
  return base;
}

module.exports = {
  cleanPage,
  cleanArticle,
  cleanBlock,
  cleanComponent,
  cleanHTML
};
