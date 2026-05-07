const { Paragraph, TextRun } = require("docx");
const path = require("path");
const {
  safeText,
  addLabelValue,
  htmlToText,
  resolveAssetRef,
  renderStandardQuestionFeedback
} = require("./utils");
const { addImageBlock } = require("./images");

function normalizeSrc(src) {
  if (!src) return "";

  // Remove query params
  src = src.split("?")[0];

  // Normalize slashes
  src = src.replace(/\\/g, "/");

  // Remove leading ./ or ../
  src = src.replace(/^(\.\/|\.\.\/)+/, "");

  // Ensure we anchor at course/assets/
  const idx = src.indexOf("course/assets/");
  if (idx !== -1) {
    src = src.substring(idx);
  }

  return src.trim();
}

const HANDLERS = {
  text: function () { },

  graphic: async function (children, c, assetMap, locPolyglot) {
    const g = c._graphic || {};

    const rel =
      (g.large && g.large.trim()) ||
      (g.small && g.small.trim()) ||
      (g.src && g.src.trim()) ||
      "";

    const alt = g.alt || "";

    if (rel) {
      await addImageBlock(children, rel, alt, assetMap, locPolyglot);
    } else {
      addLabelValue(children, locPolyglot.t('app.adaptfilescormlocation'), `(${locPolyglot.t('app.scaffold._bubbledirection.none.variable')})`);
    }
  },

  media: function (children, c, assetMap, locPolyglot) {
    const m = c._media || {};
    function addMediaLine(label, src) {
      if (!src || typeof src !== "string") return;
      const s = src.trim();
      if (!s) return;

      children.push(new Paragraph({ text: "" }));
      addLabelValue(children, label, s);

      const normalized = normalizeSrc(src);
      const filename = path.basename(normalized);
      const asset = Object.values(assetMap).find(a => a.filename === filename);
      const title = safeText(asset.title || "");
      const desc = safeText(asset.description || "");
      let originalLine = title || asset.filename;

      addLabelValue(children, `${locPolyglot.t('app.name')} (Original)`, originalLine);
      if (desc) addLabelValue(children, `Description`, desc);
      children.push(new Paragraph({ text: "" }));
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
    const tr = c._transcript;
    if (tr && typeof tr === "object") {
      const inline = !!tr._inlineTranscript;
      const external = !!tr._externalTranscript;
      addLabelValue(
        children,
        locPolyglot.t("app.transcript.settings"),
        locPolyglot.t("app.inline") + ": " + inline + "; " + locPolyglot.t("app.external") + ": " + external
      );
      const body = tr.inlineTranscriptBody || "";
      if (body) addLabelValue(children, locPolyglot.t("app.transcript.inline"), body);
    } else if (typeof tr === "string") {
      addLabelValue(children, locPolyglot.t("app.transcript"), tr);
    }
  },

  mcq: function (children, c, assetMap, locPolyglot) {
    const items = Array.isArray(c._items) ? c._items : [];
    if (items.length) {
      children.push(new Paragraph({ spacing: { after: 100 }, text: "Options" }));
      items.forEach(function (it, idx) {
        if (!it || typeof it !== "object") return;
        const txt = safeText(it.text || "") || `(${locPolyglot.t("app.blank")})`;
        const should = it._shouldBeSelected;
        let line = (idx + 1) + ". " + txt;
        if (should === true) line += " [Correct]";
        else if (should === false) line += " [Incorrect]";

        children.push(
          new Paragraph({
            spacing: { after: 100 },
            text: line,
            bullet: { level: 0 }
          })
        );

        const fb = it.feedback || "";
        if (fb) addLabelValue(children, locPolyglot.t("app.optionfeedback"), fb);
      });
      children.push(new Paragraph({ spacing: { after: 100 }, text: "" }));
    }

    // Standard question-level feedback
    if (renderStandardQuestionFeedback) {
      renderStandardQuestionFeedback(children, c, locPolyglot);
    }
  },

  gmcq: async function (children, c, assetMap, locPolyglot) {
    // Optional layout hint
    const cols = c._columns;
    if (cols !== undefined && cols !== null) {
      addLabelValue(children, locPolyglot.t("app.columns"), String(cols));
    }

    const items = Array.isArray(c._items) ? c._items : [];
    if (items.length > 0) {
      children.push(new Paragraph({ text: "Options" }));

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it || typeof it !== "object") continue;

        const txt = htmlToText(it.text || "");
        const should = it._shouldBeSelected;
        const fb = htmlToText(it.feedback || "");

        let line = `${i + 1}. ${txt || ("(" + locPolyglot.t("app.blank") + ")")}`;
        if (should === true) line += " [Correct]";
        else if (should === false) line += " [Incorrect]";

        children.push(
          new Paragraph({
            text: line,
            bullet: { level: 0 }
          })
        );

        // Option-level graphic
        const g = it._graphic || {};
        if (g && typeof g === "object") {
          const rel =
            (g.large && g.large.trim()) ||
            (g.small && g.small.trim()) ||
            (g.src && g.src.trim()) ||
            "";

          const alt = g.alt || "";

          if (rel) {
            const resolved = resolveAssetRef(rel, assetMap);
            if (resolved) {
              await addImageBlock(children, resolved, alt, assetMap, locPolyglot);
            }
          }
        }

        if (fb) {
          addLabelValue(children, locPolyglot.t("app.optionfeedback"), fb);
        }
      }
    }

    // Standard question-level feedback
    if (renderStandardQuestionFeedback) {
      renderStandardQuestionFeedback(children, c, locPolyglot);
    }
  },

  "dnd-multiple": async function (children, c, assetMap, locPolyglot) {
    const items = Array.isArray(c._items) ? c._items : [];
    addLabelValue(children, locPolyglot.t("app.numberofitems"), String(items.length));

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      if (!item || typeof item !== "object") continue;

      const title = safeText(item.title || "") || `(${locPolyglot.t("app.notitle")})`;

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: locPolyglot.t("app.item") + " " + (idx + 1) + ": " + title, bold: true })
          ]
        })
      );

      // Options (draggable items)
      const opts = Array.isArray(item._options) ? item._options : [];
      addLabelValue(children, "Options", String(opts.length));

      for (let j = 0; j < opts.length; j++) {
        const opt = opts[j];
        if (!opt || typeof opt !== "object") continue;

        const optTitle = safeText(opt.title || "") || `(${locPolyglot.t("app.blank")})`;

        children.push(
          new Paragraph({
            text: "• " + optTitle,
            bullet: { level: 0 }
          })
        );

        // Option-level graphic
        const g = opt._graphic || {};
        if (g && typeof g === "object") {
          const rel =
            (g.src && g.src.trim()) ||
            (g.large && g.large.trim()) ||
            (g.small && g.small.trim()) ||
            "";

          const alt = g.alt || "";

          if (rel) {
            await addImageBlock(children, rel, alt, assetMap, locPolyglot);
          }
        }
      }

      children.push(new Paragraph({ text: "" }));
    }

    // Attempts
    if (c._attempts !== undefined && c._attempts !== null) {
      addLabelValue(children, locPolyglot.t("app.attempts"), String(c._attempts));
    }

    if (c._feedback) {
      renderStandardQuestionFeedback(children, c, locPolyglot);
    }
  },

  matching: function (children, c, assetMap, locPolyglot) {
    const items = Array.isArray(c._items) ? c._items : [];
    addLabelValue(children, locPolyglot.t("app.matchingitems"), String(items.length));

    items.forEach(function (it, idx) {
      if (!it || typeof it !== "object") return;
      const prompt = safeText(it.text || "") || `(${locPolyglot.t("app.blank")})`;
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: locPolyglot.t("app.item") + " " + (idx + 1) + ": " + prompt,
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
        addLabelValue(children, "Options", `(${locPolyglot.t("app.scaffold._bubbledirection.none.variable")})`);
      }

      children.push(new Paragraph({ text: "" }));
    });
  },

  openTextInput: function (children, c, assetMap, locPolyglot) {
    const placeholder = c.placeholder || "";
    const model = c.modelAnswer || "";
    const allowed = c._allowedCharacters;
    const remaining = c.remainingCharactersText || "";
    const saved = c.savedMessage || "";

    if (placeholder) addLabelValue(children, locPolyglot.t("app.placeholder"), placeholder);
    if (allowed !== undefined && allowed !== null)
      addLabelValue(children, locPolyglot.t("app.allowedcharacters"), String(allowed));
    if (remaining)
      addLabelValue(children, locPolyglot.t("app.remainingcharacterstext"), remaining);
    if (saved) addLabelValue(children, locPolyglot.t("app.savedmessage"), saved);
    if (model) addLabelValue(children, locPolyglot.t("app.modelanswer"), model);

    children.push(new Paragraph({ text: "" }));
  },

  slider: function (children, c, assetMap, locPolyglot) {
    addLabelValue(
      children,
      locPolyglot.t("app.scalestart"),
      c._scaleStart !== undefined && c._scaleStart !== null
        ? String(c._scaleStart)
        : `(${locPolyglot.t('app.scaffold._bubbledirection.none.variable')})`
    );
    addLabelValue(
      children,
      locPolyglot.t("app.scaleend"),
      c._scaleEnd !== undefined && c._scaleEnd !== null
        ? String(c._scaleEnd)
        : `(${locPolyglot.t('app.scaffold._bubbledirection.none.variable')})`
    );
    addLabelValue(
      children,
      locPolyglot.t("app.scalestep"),
      c._scaleStep !== undefined && c._scaleStep !== null
        ? String(c._scaleStep)
        : `(${locPolyglot.t('app.scaffold._bubbledirection.none.variable')})`
    );
    addLabelValue(
      children,
      locPolyglot.t("app.labelstart"),
      safeText(c.labelStart || "") || `(${locPolyglot.t('app.scaffold._bubbledirection.none.variable')})`
    );
    addLabelValue(
      children,
      locPolyglot.t("app.labelend"),
      safeText(c.labelEnd || "") || `(${locPolyglot.t('app.scaffold._bubbledirection.none.variable')})`
    );

    if (c._correctAnswer !== undefined && c._correctAnswer !== null) {
      addLabelValue(children, locPolyglot.t("app.correctanswer"), String(c._correctAnswer));
    }
    if (c._correctRange !== undefined && c._correctRange !== null) {
      addLabelValue(children, locPolyglot.t("app.correctrange"), String(c._correctRange));
    }

    if (c._attempts !== undefined && c._attempts !== null) {
      addLabelValue(children, locPolyglot.t("app.attempts"), String(c._attempts));
    }

    children.push(new Paragraph({ text: "" }));
  },

  narrative: async function (children, c, assetMap, locPolyglot) {
    const items = Array.isArray(c._items) ? c._items : [];

    addLabelValue(children, locPolyglot.t("app.narrativepanels"), String(items.length));

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it || typeof it !== "object") continue;

      const title = safeText(it.title || "") || `(${locPolyglot.t("app.notitle")})`;

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${locPolyglot.t("app.panel")} ${i + 1}: ${title}`, bold: true })
          ]
        })
      );

      const body = htmlToText(it.body || "");
      if (body) {
        addLabelValue(children, locPolyglot.t("app.panelbody"), body);
      }

      const strap = htmlToText(it.strapline || "");
      if (strap) {
        addLabelValue(children, locPolyglot.t("app.panelstrapline"), strap);
      }

      const g = it._graphic || {};
      if (g && typeof g === "object") {
        const rel =
          (g.src && g.src.trim()) ||
          (g.large && g.large.trim()) ||
          (g.small && g.small.trim()) ||
          "";

        const alt = g.alt || "";

        if (rel) {
          await addImageBlock(children, rel, alt, assetMap, locPolyglot);
        }
      }

      children.push(new Paragraph({ text: "" }));
    }
  },

  accordion: async function (children, c, assetMap, locPolyglot) {
    const items = Array.isArray(c._items) ? c._items : [];

    addLabelValue(children, locPolyglot.t("app.accordionitems"), String(items.length));

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it || typeof it !== "object") continue;

      const title = safeText(it.title || "") || `(${locPolyglot.t("app.notitle")})`;

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${locPolyglot.t("app.accordion")} ${i + 1}: ${title}`, bold: true })
          ]
        })
      );

      const body = htmlToText(it.body || "");
      addLabelValue(children, locPolyglot.t("app.accordionbody"), body || `(${locPolyglot.t("app.scaffold._bubbledirection.none.variable")})`);

      const g = it._graphic || {};
      if (g && typeof g === "object") {
        const rel =
          (g.src && g.src.trim()) ||
          (g.large && g.large.trim()) ||
          (g.small && g.small.trim()) ||
          "";

        const alt = g.alt || "";

        if (rel) {
          await addImageBlock(children, rel, alt, assetMap, locPolyglot);
        }
      }

      children.push(new Paragraph({ text: "" }));
    }
  },

  hotgraphic: async function (children, c, assetMap, locPolyglot) {
    // Base graphic (main image)
    const g = c._graphic || {};
    if (g && typeof g === "object") {
      const rel =
        (g.src && g.src.trim()) ||
        (g.large && g.large.trim()) ||
        (g.small && g.small.trim()) ||
        "";

      const alt = g.alt || "";

      if (rel) {
        await addImageBlock(children, rel, alt, assetMap, locPolyglot);
        children.push(new Paragraph({ text: "" }));
      }
    }

    // Hotspots
    const items = Array.isArray(c._items) ? c._items : [];
    addLabelValue(children, "Hotspots", String(items.length));

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it || typeof it !== "object") continue;

      const title = safeText(it.title || "") || `("${locPolyglot.t("app.notitle")}")`;

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: locPolyglot.t("app.hotspot") + " " + (i + 1) + ": " + title, bold: true })
          ]
        })
      );

      const strap = htmlToText(it.strapline || "");
      if (strap) {
        addLabelValue(children, locPolyglot.t("app.strapline"), strap);
      }

      const body = htmlToText(it.body || "");
      addLabelValue(children, locPolyglot.t("app.hotspotbody"), body || `(${locPolyglot.t("app.scaffold._bubbledirection.none.variable")})`);

      // Node 12-safe fallback for left/top
      const left = (typeof it._left === "number" || typeof it._left === "string")
        ? it._left
        : "?";

      const top = (typeof it._top === "number" || typeof it._top === "string")
        ? it._top
        : "?";

      const coords = `${locPolyglot.t("app.layoutleft")}: ` + left + `%, ${locPolyglot.t("app.top")}: ` + top + "%";
      addLabelValue(children, "Position", coords);

      // Hotspot-level graphic
      const ig = it._graphic || {};
      if (ig && typeof ig === "object") {
        const rel =
          (ig.src && ig.src.trim()) ||
          (ig.large && ig.large.trim()) ||
          (ig.small && ig.small.trim()) ||
          "";

        const alt = ig.alt || "";

        if (rel) {
          await addImageBlock(children, rel, alt, assetMap, locPolyglot);
        }
      }

      children.push(new Paragraph({ text: "" }));
      let _pin = it._pin || {};
      if (_pin && typeof _pin === "object") {
        let relPin =
          (_pin.src && _pin.src.trim()) ||
          (_pin.large && _pin.large.trim()) ||
          (_pin.small && _pin.small.trim()) ||
          "";

        let altPin = _pin.alt || "";

        if (relPin) {
          addLabelValue(children, locPolyglot.t("app.pin"), locPolyglot.t("app.item") + " " + (i+1));
          await addImageBlock(children, relPin, altPin, assetMap, locPolyglot);
          children.push(new Paragraph({ text: "" }));
        }
      }
    }
  },

  hotgrid: async function (children, c, assetMap, locPolyglot) {
    const items = Array.isArray(c._items) ? c._items : [];

    addLabelValue(children, locPolyglot.t("app.hotgriditems"), String(items.length));

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it || typeof it !== "object") continue;

      const title = safeText(it.title || "") || `("${locPolyglot.t("app.notitle")}")`;

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${locPolyglot.t("app.hotgridtile")} ${i + 1}: ${title}`, bold: true })
          ]
        })
      );

      const body = htmlToText(it.body || "");
      addLabelValue(children, locPolyglot.t("app.tilebody"), body || `("${locPolyglot.t("app.scaffold._bubbledirection.none.variable")}")`);

      const g = it._graphic || {};
      if (g && typeof g === "object") {
        const rel =
          (g.src && g.src.trim()) ||
          (g.large && g.large.trim()) ||
          (g.small && g.small.trim()) ||
          "";

        const alt = g.alt || "";
        const hoverImg = g.srcHover && g.srcHover.trim() ? g.srcHover.trim() : null;
        const visitedImg = g.srcVisited && g.srcVisited.trim() ? g.srcVisited.trim() : null;

        if (rel) {
          children.push(new Paragraph({ text: "" }));
          addLabelValue(children, "Image", "Popup");
          await addImageBlock(children, rel, alt, assetMap, locPolyglot);
        }
        if (hoverImg) {
          addLabelValue(children, "Image", locPolyglot.t("app.hover"));
          await addImageBlock(children, hoverImg, "", assetMap, locPolyglot);
        }
        if (visitedImg) {
          addLabelValue(children, "Image", locPolyglot.t("app.visited"));
          await addImageBlock(children, visitedImg, "", assetMap, locPolyglot);
        }
      }

      children.push(new Paragraph({ text: "" }));

      const itemGraphic = it._itemGraphic || {};
      if (itemGraphic && typeof itemGraphic === 'object') {
        const relItemGraphic =
          (itemGraphic.src && itemGraphic.src.trim()) ||
          (itemGraphic.large && itemGraphic.large.trim()) ||
          (itemGraphic.small && itemGraphic.small.trim()) ||
          "";

        const alt = itemGraphic.alt || "";

        if (relItemGraphic) {
          await addImageBlock(children, relItemGraphic, alt, assetMap, locPolyglot);
        }
      }
    }
  },

  guidedtour: async function (children, c, assetMap, locPolyglot) {
    const items = Array.isArray(c._items) ? c._items : [];

    addLabelValue(children, locPolyglot.t("app.toursteps"), String(items.length));

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it || typeof it !== "object") continue;

      const title = safeText(it.title || "") || `("${locPolyglot.t("app.notitle")}")`;

      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${locPolyglot.t("app.step")} ${i + 1}: ${title}`, bold: true })
          ]
        })
      );

      const body = htmlToText(it.body || "");
      addLabelValue(children, locPolyglot.t("app.stepbody"), body || `(${locPolyglot.t("app.scaffold._bubbledirection.none.variable")})`);

      // Step-level graphic
      const g = it._graphic || {};
      if (g && typeof g === "object") {
        const rel =
          (g.src && g.src.trim()) ||
          (g.large && g.large.trim()) ||
          (g.small && g.small.trim()) ||
          "";

        const alt = g.alt || "";

        if (rel) {
          await addImageBlock(children, rel, alt, assetMap, locPolyglot);
        }
      }

      const pin = it._pin || {};
      if (pin && typeof pin === "object" && (pin.src || pin.alt)) {
        const pinText = `${pin.src || ""} ${pin.alt || ""}`.trim() || `(${locPolyglot.t("app.scaffold._bubbledirection.none.variable")})`;
        addLabelValue(children, locPolyglot.t("app.pin"), pinText);
      }

      children.push(new Paragraph({ text: "" }));
    }
  },

  simulation: async function (children, c, assetMap, locPolyglot) {
    const screens = Array.isArray(c._items) ? c._items : [];

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: locPolyglot.t("app.simulationscreensandsteps"), bold: true })
        ]
      })
    );
    addLabelValue(children, locPolyglot.t("app.numberofscreens"), String(screens.length));

    for (let sIdx = 0; sIdx < screens.length; sIdx++) {
      const screen = screens[sIdx];
      if (!screen || typeof screen !== "object") continue;

      const title = safeText(screen.title || "") || locPolyglot.t("app.screen") + " " + (sIdx + 1);
      const disp = safeText(screen.displayTitle || "");
      const sid = safeText(screen._screenID || "");

      let line = locPolyglot.t("app.screen") + " " + (sIdx + 1) + ": " + title;
      if (disp && disp !== title) line += " — " + disp;

      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, bold: true })]
        })
      );

      if (sid) addLabelValue(children, locPolyglot.t("app.screenid"), sid);

      const body = screen.body || "";
      if (body) addLabelValue(children, locPolyglot.t("app.screenbody"), body);

      const g = screen._graphic || {};
      if (g.src) {
        await addImageBlock(children, g.src, g.alt || "", assetMap, locPolyglot);
      }

      children.push(new Paragraph({ text: "" }));

      const steps = Array.isArray(screen._childItems) ? screen._childItems : [];
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: locPolyglot.t("app.stepsforscreen") + " " + (sIdx + 1),
              bold: true
            })
          ]
        })
      );
      addLabelValue(children, locPolyglot.t("app.numberofsteps"), String(steps.length));

      for (let stIdx = 0; stIdx < steps.length; stIdx++) {
        const step = steps[stIdx];
        if (!step || typeof step !== "object") continue;
        const stTitle = safeText(step.title || "") || locPolyglot.t("app.step") + " " + (stIdx + 1);

        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: locPolyglot.t("app.step") + " " + (stIdx + 1) + ": " + stTitle,
                bold: true
              })
            ],
            bullet: { level: 0 }
          })
        );

        const taskLabel = step._taskLabel;
        if (typeof taskLabel === "string" && taskLabel.trim()) {
          addLabelValue(children, locPolyglot.t("app.tasklabel"), taskLabel.trim());
        }
        const sg = step._graphic || {};
        if (sg.src) {
          await addImageBlock(children, sg.src, sg.alt || "", assetMap, locPolyglot);
        }
      }
    }
  },

  quicknav: function (children, c, assetMap, locPolyglot) {
    const buttons = c._buttons || {};
    if (!buttons || typeof buttons !== "object" || !Object.keys(buttons).length) {
      addLabelValue(children, locPolyglot.t("app.quicknav.buttons"), `(${locPolyglot.t("app.scaffold._bubbledirection.none.variable")})`);
      return;
    }

    children.push(
      new Paragraph({
        children: [new TextRun({ text: locPolyglot.t("app.quicknav.buttons"), bold: true })]
      })
    );
    addLabelValue(children, locPolyglot.t("app.numberofbuttons"), String(Object.keys(buttons).length));

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
      const labelDisp = label || keyDisp || `(${locPolyglot.t("app.unlabeled")})`;

      let enabledDisp = "";
      if (b && typeof b._isEnabled === "boolean") {
        enabledDisp = b._isEnabled ? ` (${locPolyglot.t("app.enabled")})` : ` (${locPolyglot.t("app.disabled")})`;
      }

      let textVal = "";
      if (b && typeof b.text === "string") {
        textVal = b.text;
      } else if (b && b.text != null) {
        textVal = String(b.text);
      }

      const textClean = safeText(textVal) || `(${locPolyglot.t("app.scaffold._bubbledirection.none.variable")})`;

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
  },

  talk: async function (children, c, assetMap, locPolyglot) {
    // --- Characters section ---
    children.push(
      new Paragraph({
        children: [new TextRun({ text: locPolyglot.t("app.talk.characters"), bold: true })]
      })
    );

    const chars = Array.isArray(c._characters) ? c._characters : [];
    addLabelValue(children, locPolyglot.t("app.numberofcharacters"), String(chars.length));

    for (let idx = 0; idx < chars.length; idx++) {
      const ch = chars[idx];
      if (!ch || typeof ch !== "object") continue;

      const name = safeText(ch.name || "") || `${locPolyglot.t("app.character")} ${idx + 1}`;
      const pos = safeText(ch.position || "");

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: pos ? `${name} (${pos})` : name,
              bold: true
            })
          ]
        })
      );

      const g = ch._graphic || {};
      if (g && typeof g === "object" && g.src) {
        await addImageBlock(children, g.src, g.alt || "", assetMap, locPolyglot);
      }

      children.push(new Paragraph({ text: "" }));
    }

    // --- Messages section ---
    children.push(
      new Paragraph({
        children: [new TextRun({ text: locPolyglot.t("app.talk.messages"), bold: true })]
      })
    );

    const items = Array.isArray(c._items) ? c._items : [];
    addLabelValue(children, locPolyglot.t("app.numberofmessages"), String(items.length));

    // Speaker resolver
    function resolveSpeaker(it) {
      const cname = safeText(it._characterName || "");
      if (cname) return cname;

      let idx = parseInt(it._character, 10);
      if (isNaN(idx)) return `(${locPolyglot.t("app.unknownspeaker")})`;

      if (idx === 0) return locPolyglot.t("app.narrator");
      if (idx >= 1 && idx <= chars.length) {
        const nm = safeText(chars[idx - 1].name || "");
        return nm || `${locPolyglot.t("app.character")} ${idx}`;
      }

      return `(${locPolyglot.t("app.unknownspeaker")})`;
    }

    items.forEach((it, idx) => {
      if (!it || typeof it !== "object") return;

      const speaker = resolveSpeaker(it);
      const text = safeText(it.text || "");
      const mp3 = safeText(it._mp3 || "");
      const g = it._graphic || {};

      // Message heading
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Message ${idx + 1}: ${speaker}`,
              bold: true
            })
          ]
        })
      );

      addLabelValue(children, locPolyglot.t("app.dialogue"), text || `(${locPolyglot.t("app.scaffold._bubbledirection.none.variable")})`);

      if (mp3) {
        addLabelValue(children, locPolyglot.t("app.audiofile"), mp3);
      }

      if (g && typeof g === "object" && g.src) {
        // TODO: insert image block once your image helper is ready
        addLabelValue(children, locPolyglot.t("app.graphic.source"), g.src);
        if (g.alt) addLabelValue(children, locPolyglot.t("app.graphic.alt"), g.alt);
      }

      children.push(new Paragraph({ text: "" }));
    });
  },

};

module.exports = HANDLERS;
