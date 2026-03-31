const { Paragraph, TextRun } = require("docx");
const { safeText, addLabelValue } = require("./utils");

const HANDLERS = {
  text: function () { },

  graphic: function () { },

  media: function (children, c) {
    const m = c._media || {};
    const lines = [];

    function addMediaLine(label, src) {
      if (!src || typeof src !== "string") return;
      const s = src.trim();
      if (!s) return;
      lines.push(label + ": " + s);
    }

    ["mp4", "webm", "ogv", "mp3", "poster", "source"].forEach(k => {
      if (m[k]) addMediaLine(k, m[k]);
    });

    const ccList = Array.isArray(m.cc) ? m.cc : [];
    ccList.forEach(cc => {
      if (!cc || typeof cc !== "object") return;
      const lang = safeText(cc.srclang || "");
      const src = safeText(cc.src || "");
      if (!src) return;
      addMediaLine(lang ? "cc (" + lang + ")" : "cc", src);
    });

    addLabelValue(children, "Media files", lines.length ? lines.join("\n") : "(none)");
    children.push(new Paragraph({ text: "" }));

    const tr = c._transcript;
    if (tr && typeof tr === "object") {
      const inline = !!tr._inlineTranscript;
      const external = !!tr._externalTranscript;
      addLabelValue(
        children,
        "Transcript settings",
        "Inline: " + inline + "; External: " + external
      );
      const body = tr.inlineTranscriptBody || "";
      if (body) addLabelValue(children, "Transcript (inline)", body);
    } else if (typeof tr === "string") {
      addLabelValue(children, "Transcript", tr);
    }
  },

  mcq: function (children, c) {
    const items = Array.isArray(c._items) ? c._items : [];
    if (items.length) {
      children.push(new Paragraph({ text: "Options" }));
      items.forEach(function (it, idx) {
        if (!it || typeof it !== "object") return;
        const txt = safeText(it.text || "") || "(blank)";
        const should = it._shouldBeSelected;
        let line = (idx + 1) + ". " + txt;
        if (should === true) line += " [Correct]";
        else if (should === false) line += " [Incorrect]";

        children.push(
          new Paragraph({
            text: line,
            bullet: { level: 0 }
          })
        );

        const fb = it.feedback || "";
        if (fb) addLabelValue(children, "Option feedback", fb);
      });
      children.push(new Paragraph({ text: "" }));
    }

    const fb = c._feedback || {};
    if (fb && typeof fb === "object" && Object.keys(fb).length) {
      const corr = safeText(fb.correct || "") || "(none)";
      const inc = fb._incorrect || {};
      const pc = fb._partlyCorrect || {};

      const incFinal = safeText((inc.final || "") || "");
      const incNotFinal = safeText((inc.notFinal || "") || "");
      const pcFinal = safeText((pc.final || "") || "");

      addLabelValue(children, "Feedback (correct)", corr);
      addLabelValue(children, "Feedback (incorrect - final)", incFinal || "(none)");
      if (incNotFinal)
        addLabelValue(children, "Feedback (incorrect - not final)", incNotFinal);
      if (pcFinal)
        addLabelValue(children, "Feedback (partly correct - final)", pcFinal);
    }
  },

  gmcq: function (children, c) {
    HANDLERS.mcq(children, c);
  },

  "dnd-multiple": function (children, c) {
    if (c.instruction) {
      addLabelValue(children, "Instruction", safeText(c.instruction));
    }

    if (c.ariaQuestion) {
      addLabelValue(children, "ARIA question", safeText(c.ariaQuestion));
    }

    const items = Array.isArray(c._items) ? c._items : [];
    addLabelValue(children, "Number of items", String(items.length));

    items.forEach((item, idx) => {
      const title = safeText(item.title || "") || "(no title)";

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `Item ${idx + 1}: ${title}`, bold: true })
          ]
        })
      );

      const opts = Array.isArray(item._options) ? item._options : [];
      addLabelValue(children, "Options", String(opts.length));

      opts.forEach((opt, j) => {
        const optTitle = safeText(opt.title || "") || "(blank)";

        children.push(
          new Paragraph({
            text: `• ${optTitle}`,
            bullet: { level: 0 }
          })
        );

        if (opt._graphic) {
          const g = opt._graphic;

          if (g.src || g.large || g.small) {
            addLabelValue(children, "Graphic source", g.src || g.large || g.small);
          }

          if (g.alt) {
            addLabelValue(children, "Graphic alt text", g.alt);
          }
        }
      });

      children.push(new Paragraph({ text: "" }));
    });

    if (c._attempts !== undefined && c._attempts !== null) {
      addLabelValue(children, "Attempts", String(c._attempts));
    }
  },

  matching: function (children, c) {
    const items = Array.isArray(c._items) ? c._items : [];
    addLabelValue(children, "Matching items", String(items.length));

    items.forEach(function (it, idx) {
      if (!it || typeof it !== "object") return;
      const prompt = safeText(it.text || "") || "(blank)";
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Item " + (idx + 1) + ": " + prompt,
              bold: true
            })
          ]
        })
      );

      const opts = Array.isArray(it._options) ? it._options : [];
      if (opts.length) {
        opts.forEach(function (opt, j) {
          if (!opt || typeof opt !== "object") return;
          const ot = safeText(opt.text || "") || "(blank)";
          let line = (j + 1) + ". " + ot;
          if (opt._isCorrect === true) line += " [Correct]";
          children.push(
            new Paragraph({
              text: line,
              bullet: { level: 0 }
            })
          );
        });
      } else {
        addLabelValue(children, "Options", "(none)");
      }

      children.push(new Paragraph({ text: "" }));
    });
  },

  openTextInput: function (children, c) {
    const placeholder = c.placeholder || "";
    const model = c.modelAnswer || "";
    const allowed = c._allowedCharacters;
    const remaining = c.remainingCharactersText || "";
    const saved = c.savedMessage || "";

    if (placeholder) addLabelValue(children, "Placeholder", placeholder);
    if (allowed !== undefined && allowed !== null)
      addLabelValue(children, "Allowed characters", String(allowed));
    if (remaining)
      addLabelValue(children, "Remaining characters text", remaining);
    if (saved) addLabelValue(children, "Saved message", saved);
    if (model) addLabelValue(children, "Model answer", model);

    children.push(new Paragraph({ text: "" }));
  },

  slider: function (children, c) {
    addLabelValue(
      children,
      "Scale start",
      c._scaleStart !== undefined && c._scaleStart !== null
        ? String(c._scaleStart)
        : "(none)"
    );
    addLabelValue(
      children,
      "Scale end",
      c._scaleEnd !== undefined && c._scaleEnd !== null
        ? String(c._scaleEnd)
        : "(none)"
    );
    addLabelValue(
      children,
      "Scale step",
      c._scaleStep !== undefined && c._scaleStep !== null
        ? String(c._scaleStep)
        : "(none)"
    );
    addLabelValue(
      children,
      "Label start",
      safeText(c.labelStart || "") || "(none)"
    );
    addLabelValue(
      children,
      "Label end",
      safeText(c.labelEnd || "") || "(none)"
    );

    if (c._correctAnswer !== undefined && c._correctAnswer !== null) {
      addLabelValue(children, "Correct answer", String(c._correctAnswer));
    }
    if (c._correctRange !== undefined && c._correctRange !== null) {
      addLabelValue(children, "Correct range", String(c._correctRange));
    }

    if (c._attempts !== undefined && c._attempts !== null) {
      addLabelValue(children, "Attempts", String(c._attempts));
    }

    children.push(new Paragraph({ text: "" }));
  },

  narrative: function (children, c) {
    const items = Array.isArray(c._items) ? c._items : [];
    addLabelValue(children, "Narrative panels", String(items.length));

    items.forEach(function (it, idx) {
      if (!it || typeof it !== "object") return;
      const title = safeText(it.title || "") || "(no title)";

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Panel " + (idx + 1) + ": " + title,
              bold: true
            })
          ]
        })
      );

      const body = it.body || "";
      if (body) addLabelValue(children, "Panel body", body);

      const strap = it.strapline || "";
      if (strap) addLabelValue(children, "Panel strapline", strap);

      children.push(new Paragraph({ text: "" }));
    });
  },

  accordion: function (children, c) {
    const items = Array.isArray(c._items) ? c._items : [];
    addLabelValue(children, "Accordion items", String(items.length));

    items.forEach(function (it, idx) {
      if (!it || typeof it !== "object") return;
      const title = safeText(it.title || "") || "(no title)";

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Accordion " + (idx + 1) + ": " + title,
              bold: true
            })
          ]
        })
      );

      const body = it.body || "";
      addLabelValue(children, "Accordion body", body || "(none)");

      children.push(new Paragraph({ text: "" }));
    });
  },

  simulation: function (children, c) {
    const screens = Array.isArray(c._items) ? c._items : [];

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Simulation: Screens and steps", bold: true })
        ]
      })
    );
    addLabelValue(children, "Number of screens", String(screens.length));

    screens.forEach(function (screen, sIdx) {
      if (!screen || typeof screen !== "object") return;

      const title = safeText(screen.title || "") || "Screen " + (sIdx + 1);
      const disp = safeText(screen.displayTitle || "");
      const sid = safeText(screen._screenID || "");

      let line = "Screen " + (sIdx + 1) + ": " + title;
      if (disp && disp !== title) line += " — " + disp;

      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, bold: true })]
        })
      );

      if (sid) addLabelValue(children, "Screen ID", sid);

      const body = screen.body || "";
      if (body) addLabelValue(children, "Screen body", body);

      children.push(new Paragraph({ text: "" }));

      const steps = Array.isArray(screen._childItems) ? screen._childItems : [];
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Steps for Screen " + (sIdx + 1),
              bold: true
            })
          ]
        })
      );
      addLabelValue(children, "Number of steps", String(steps.length));

      steps.forEach(function (step, stIdx) {
        if (!step || typeof step !== "object") return;
        const stTitle = safeText(step.title || "") || "Step " + (stIdx + 1);

        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Step " + (stIdx + 1) + ": " + stTitle,
                bold: true
              })
            ],
            bullet: { level: 0 }
          })
        );

        const taskLabel = step._taskLabel;
        if (typeof taskLabel === "string" && taskLabel.trim()) {
          addLabelValue(children, "Task label", taskLabel.trim());
        }
      });
    });
  },

  quicknav: function (children, c) {
    const buttons = c._buttons || {};
    if (!buttons || typeof buttons !== "object" || !Object.keys(buttons).length) {
      addLabelValue(children, "QuickNav buttons", "(none)");
      return;
    }

    children.push(
      new Paragraph({
        children: [new TextRun({ text: "QuickNav: Buttons", bold: true })]
      })
    );
    addLabelValue(children, "Number of buttons", String(Object.keys(buttons).length));

    const items = [];
    Object.keys(buttons).forEach(function (key) {
      const b = buttons[key];
      if (b && typeof b === "object") {
        let orderVal = 9999;
        if (b._order !== undefined && b._order !== null) {
          const n = parseInt(b._order, 10);
          if (!isNaN(n)) orderVal = n;
        }
        items.push([orderVal, key, b]);
      } else {
        items.push([9999, key, {}]);
      }
    });

    items.sort(function (a, b) {
      if (a[0] !== b[0]) return a[0] - b[0];
      return a[1].toLowerCase().localeCompare(b[1].toLowerCase());
    });

    items.forEach(function (entry) {
      const key = entry[1];
      const b = entry[2];
      const keyDisp = key.replace(/^_+/, "").trim();

      let label = "";
      if (b && typeof b === "object") {
        label = safeText(b.ariaLabel || b.label || "");
      }
      const labelDisp = label || keyDisp || "(unlabeled)";

      let enabledDisp = "";
      if (b && typeof b._isEnabled === "boolean") {
        enabledDisp = b._isEnabled ? " (Enabled)" : " (Disabled)";
      }

      let textVal = "";
      if (b && typeof b.text === "string") {
        textVal = b.text;
      } else if (b && b.text != null) {
        textVal = String(b.text);
      }

      const textClean = safeText(textVal) || "(none)";

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: labelDisp + enabledDisp + ": ",
              bold: true
            }),
            new TextRun(textClean)
          ]
        })
      );
    });
  }
};

module.exports = HANDLERS;
