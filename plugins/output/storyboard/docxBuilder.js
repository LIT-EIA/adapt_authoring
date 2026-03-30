const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ImageRun,
  AlignmentType
} = require("docx");
const filestorage = require("../../../lib/filestorage");
const sizeOf = require("image-size");

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

/* --- IMAGE HANDLER (UNCHANGED PIPELINE) --- */
async function renderImages(component, assetMap, children) {
  const findAssets = (obj) => {
    let found = [];
    const walk = (v) => {
      if (typeof v === "string" && v.indexOf("course/assets/") !== -1) {
        found.push(path.basename(v));
      } else if (v && typeof v === "object") {
        Object.keys(v).forEach(function (k) {
          walk(v[k]);
        });
      }
    };
    walk(obj);
    return found.filter(function (item, pos) {
      return found.indexOf(item) === pos;
    });
  };

  const filenames = findAssets(component);
  const assets = Object.keys(assetMap)
    .map(function (key) {
      return assetMap[key];
    })
    .filter(function (a) {
      return filenames.indexOf(a.filename) !== -1;
    });

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    try {
      let buffer = await new Promise((resolve, reject) => {
        filestorage.getStorage(asset.repository, function (err, s) {
          if (err) return reject(err);
          s.getFileContents(asset.path, function (e, b) {
            return e ? reject(e) : resolve(b);
          });
        });
      });

      if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);

      // Strip UTF‑8 BOM if present
      if (
        buffer.length > 3 &&
        buffer[0] === 0xef &&
        buffer[1] === 0xbb &&
        buffer[2] === 0xbf
      ) {
        buffer = buffer.slice(3);
      }

      const lower = asset.filename.toLowerCase();
      let imgType = "jpg";
      if (lower.endsWith(".png")) imgType = "png";
      else if (lower.endsWith(".gif")) imgType = "gif";
      else if (lower.endsWith(".jpeg")) imgType = "jpg";

      // Skip SVG (DOCX doesn’t support it)
      if (lower.endsWith(".svg")) {
        continue;
      }

      let width = 400;
      let height = 300;
      try {
        const dim = sizeOf(buffer);
        if (dim && dim.width && dim.height) {
          width = dim.width;
          height = dim.height;
          const MAX_WIDTH = 600;
          if (width > MAX_WIDTH) {
            const scale = MAX_WIDTH / width;
            width = MAX_WIDTH;
            height = Math.round(height * scale);
          }
        }
      } catch (e) {
        // keep defaults
      }

      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: buffer,
              type: imgType,
              transformation: { width, height }
            })
          ]
        })
      );
    } catch (e) {
      // silently skip on error (keeps DOCX valid)
    }
  }
}

/* --- COMPONENT HANDLERS (PYTHON-ALIGNED LABELS/STRUCTURE, SIMPLIFIED) --- */

const HANDLERS = {
  text: function (children, c) {
    // Python _handle_text: only heading + common fields
    // Already handled in main loop; nothing extra here
  },

  graphic: function (children, c) {
    // Python _handle_graphic: heading + common fields + image
    // Image is handled globally via renderImages
  },

  media: function (children, c) {
    const m = c._media || {};
    const lines = [];

    function addMediaLine(label, src) {
      if (!src || typeof src !== "string") return;
      const s = src.trim();
      if (!s) return;
      lines.push(label + ": " + s);
    }

    ["mp4", "webm", "ogv", "mp3", "poster", "source"].forEach(function (k) {
      if (m[k]) addMediaLine(k, m[k]);
    });

    const ccList = Array.isArray(m.cc) ? m.cc : [];
    ccList.forEach(function (cc) {
      if (!cc || typeof cc !== "object") return;
      const lang = safeText(cc.srclang || "");
      const src = safeText(cc.src || "");
      if (!src) return;
      addMediaLine(lang ? "cc (" + lang + ")" : "cc", src);
    });

    addLabelValue(
      children,
      "Media files",
      lines.length ? lines.join("\n") : "(none)"
    );
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
      addLabelValue(
        children,
        "Feedback (incorrect - final)",
        incFinal || "(none)"
      );
      if (incNotFinal)
        addLabelValue(
          children,
          "Feedback (incorrect - not final)",
          incNotFinal
        );
      if (pcFinal)
        addLabelValue(
          children,
          "Feedback (partly correct - final)",
          pcFinal
        );
    }
  },

  gmcq: function (children, c) {
    // Simplified: reuse MCQ behavior
    HANDLERS.mcq(children, c);
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
        children: [new TextRun({ text: "Simulation: Screens and steps", bold: true })]
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

/* --- MAIN BUILDER --- */
module.exports = async function buildDocx(data, outputPath, done) {
  try {
    const children = [];
    const hierarchy = data._storyboardHierarchy || [];
    const assetMap = data._storyboardAssets || {};

    // Course title
    children.push(
      new Paragraph({
        text: data.course && data.course.title ? data.course.title : "Course",
        heading: HeadingLevel.HEADING_1
      })
    );

    for (let i = 0; i < hierarchy.length; i++) {
      const p = hierarchy[i];
      children.push(
        new Paragraph({
          text: "PAGE: " + (p.page && p.page.title ? p.page.title : "(no title)"),
          heading: HeadingLevel.HEADING_1
        })
      );

      for (let j = 0; j < p.articles.length; j++) {
        const a = p.articles[j];
        children.push(
          new Paragraph({
            text:
              "Article: " +
              (a.article && a.article.title ? a.article.title : "(no title)"),
            heading: HeadingLevel.HEADING_2
          })
        );

        for (let k = 0; k < a.blocks.length; k++) {
          const b = a.blocks[k];
          children.push(
            new Paragraph({
              text:
                "Block: " +
                (b.block && b.block.title ? b.block.title : "(no title)"),
              heading: HeadingLevel.HEADING_3
            })
          );

          for (let l = 0; l < b.components.length; l++) {
            const c = b.components[l];

            // Component heading (Python _component_heading)
            const ctype = c.type || c._component || "(unknown)";
            const layout = c.layout || c._layoutName || "";
            const headingLine =
              "Component: " + ctype + (layout ? " — " + layout : "");
            children.push(
              new Paragraph({
                text: headingLine,
                heading: HeadingLevel.HEADING_4
              })
            );

            // Component title (Intense Quote)
            const compTitle = safeText(c.title || c.displayTitle || "");
            children.push(
              new Paragraph({
                text: compTitle || "(no component title)",
                style: "IntenseQuote"
              })
            );

            // Common fields (Python _add_common_fields, simplified)
            const bodyRaw = c.body || "";
            addLabelValue(
              children,
              "Body text",
              bodyRaw ? bodyRaw : "(none)"
            );

            const instrRaw = c.instruction || "";
            addLabelValue(
              children,
              "Instructions",
              instrRaw ? instrRaw : "(none)"
            );

            // Component-specific handler
            const typeKey = (c.type || "").toString();
            if (typeKey && HANDLERS[typeKey]) {
              HANDLERS[typeKey](children, c);
            }

            // Images (global scan, but stable and working)
            await renderImages(c, assetMap, children);

            // Separator line between components
            children.push(
              new Paragraph({
                text:
                  "__________________________________________________________________"
              })
            );
          }
        }
      }
    }

    const doc = new Document({
      styles: {
        paragraphStyles: [
          {
            id: "Normal",
            name: "Normal",
            run: { font: "Arial", size: 22 }
          },
          {
            id: "Heading1",
            name: "Heading 1",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: { font: "Arial", size: 32, bold: true, color: "7030A0" }
          },
          {
            id: "Heading2",
            name: "Heading 2",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: { font: "Arial", size: 30, bold: true, color: "1F497D" }
          },
          {
            id: "Heading3",
            name: "Heading 3",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: { font: "Arial", size: 28, bold: true, color: "0070C0" }
          },
          {
            id: "Heading4",
            name: "Heading 4",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: { font: "Arial", size: 26, bold: true, color: "808240" }
          },
          {
            id: "IntenseQuote",
            name: "Intense Quote",
            basedOn: "Normal",
            next: "Normal",
            run: { font: "Arial", size: 24, italic: true, color: "444444" },
            paragraph: {
              indent: { left: 400, right: 400 },
              spacing: { before: 100, after: 100 }
            }
          }
        ]
      },
      sections: [{ children: children }]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFile(outputPath, buffer, function (err) {
      if (err) return done(err);
      return done();
    });
  } catch (err) {
    return done(err);
  }
};
