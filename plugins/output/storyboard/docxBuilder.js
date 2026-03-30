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
  if (!str) return "";
  return String(str).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD\u202A-\u202E]/g, "").trim();
}

function addLabelValue(children, label, value) {
  children.push(new Paragraph({
    children: [
      new TextRun({ text: label + ": ", bold: true }),
      new TextRun(safeText(value) || "(none)")
    ],
    spacing: { after: 120 }
  }));
}

/* --- IMAGE HANDLER --- */
async function renderImages(component, assetMap, children) {
  const findAssets = (obj) => {
    let found = [];
    const walk = (v) => {
      if (typeof v === "string" && v.indexOf("course/assets/") !== -1) {
        found.push(path.basename(v));
      } else if (v && typeof v === "object") {
        Object.keys(v).forEach(function(k) { walk(v[k]); });
      }
    };
    walk(obj);
    return found.filter(function(item, pos) { return found.indexOf(item) === pos; });
  };

  const filenames = findAssets(component);
  const assets = Object.keys(assetMap)
    .map(function(key) { return assetMap[key]; })
    .filter(function(a) { return filenames.indexOf(a.filename) !== -1; });

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    try {
      let buffer = await new Promise((resolve, reject) => {
        filestorage.getStorage(asset.repository, function(err, s) {
          if (err) return reject(err);
          s.getFileContents(asset.path, function(e, b) { e ? reject(e) : resolve(b); });
        });
      });

      // Normalize buffer (like old code)
      if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);

      // Strip UTF‑8 BOM if present
      if (buffer.length > 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        buffer = buffer.slice(3);
      }

      addLabelValue(children, "Adapt Image File SCORM Location", asset.path);
      const metaStr = (asset.title || "") + (asset.description ? " Image Description in Metatag: " + asset.description : "");
      addLabelValue(children, "Original Image file Adapt Asset Name", metaStr);

      // Determine image type from filename (CRITICAL)
      const lower = asset.filename.toLowerCase();
      let imgType = "jpg";
      if (lower.endsWith(".png")) imgType = "png";
      else if (lower.endsWith(".gif")) imgType = "gif";
      else if (lower.endsWith(".jpeg")) imgType = "jpg";

      // SVG not supported in DOCX
      if (lower.endsWith(".svg")) {
        addLabelValue(children, "Image embed warning", "SVG not supported in DOCX: " + asset.filename);
        continue;
      }

      // Safe dimension handling
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

      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: buffer,
            type: imgType,              // <-- restored
            transformation: { width, height }
          })
        ]
      }));

      addLabelValue(children, "Alt text", (component._graphic && component._graphic.alt) || "(none)");
    } catch (e) {
      addLabelValue(children, "Image embed warning", "Could not embed image: " + asset.filename);
    }
  }
}

/* --- COMPONENT HANDLERS --- */
const HANDLERS = {
  "accordion": function(children, c) {
    (c._items || []).forEach(function(item, idx) {
      children.push(new Paragraph({ text: "Accordion Item " + (idx + 1) + ": " + item.title, bold: true }));
      if (item.body) children.push(new Paragraph(safeText(item.body)));
    });
  },
  "narrative": function(children, c) {
    (c._items || []).forEach(function(item, idx) {
      children.push(new Paragraph({ text: "Narrative Slide " + (idx + 1), bold: true }));
      if (item.title) addLabelValue(children, "Title", item.title);
      if (item.body) children.push(new Paragraph(safeText(item.body)));
    });
  },
  "media": function(children, c) {
    if (c._media && c._media.mp4) addLabelValue(children, "Video File", path.basename(c._media.mp4));
    if (c._transcript && c._transcript.inlineTranscript) addLabelValue(children, "Transcript", c._transcript.inlineTranscript);
  },
  "mcq": function(children, c) {
    const correctOnes = (c._items || [])
      .filter(function(i) { return i._shouldBeSelected; })
      .map(function(i) { return i.text; })
      .join(", ");
    addLabelValue(children, "Model Answer", correctOnes);
    (c._items || []).forEach(function(item, idx) {
      children.push(new Paragraph({ text: "Option " + (idx + 1) + ": " + item.text, bullet: { level: 0 } }));
      if (item.feedback) addLabelValue(children, "Option Feedback", item.feedback);
    });
  },
  "matching": function(children, c) {
    (c._items || []).forEach(function(item, idx) {
      children.push(new Paragraph({ text: "Pair " + (idx + 1) + ": " + item.text + " <--> " + item._answer, bullet: { level: 0 } }));
    });
  },
  "slider": function(children, c) {
    addLabelValue(children, "Model Answer (Value)", c._modelAnswer);
    addLabelValue(children, "Scale Range", (c._range ? c._range.start : 0) + " to " + (c._range ? c._range.end : 100));
  },
  "textinput": function(children, c) {
    addLabelValue(children, "Model Answer (Accepted Phrases)", (c._answers || []).map(function(a) { return a.value; }).join(" | "));
  },
  "simulation": function(children, c) {
    (c._items || []).forEach(function(screen, idx) {
      children.push(new Paragraph({ text: "Simulation Screen " + (idx + 1) + ": " + screen.title, heading: HeadingLevel.HEADING_4 }));
      (screen._childItems || []).forEach(function(step, sIdx) {
        children.push(new Paragraph({ text: "Step " + (sIdx + 1) + ": " + step.title, indent: { left: 720 } }));
      });
    });
  }
};

/* --- MAIN BUILDER --- */
module.exports = async function buildDocx(data, outputPath, done) {
  try {
    const children = [];
    const hierarchy = data._storyboardHierarchy || [];
    const assetMap = data._storyboardAssets || {};

    children.push(new Paragraph({ text: data.course.title, heading: HeadingLevel.HEADING_1 }));

    for (let i = 0; i < hierarchy.length; i++) {
      const p = hierarchy[i];
      children.push(new Paragraph({ text: "PAGE: " + p.page.title, heading: HeadingLevel.HEADING_1 }));

      for (let j = 0; j < p.articles.length; j++) {
        const a = p.articles[j];
        children.push(new Paragraph({ text: "Article: " + a.article.title, heading: HeadingLevel.HEADING_2 }));

        for (let k = 0; k < a.blocks.length; k++) {
          const b = a.blocks[k];
          children.push(new Paragraph({ text: "Block: " + b.block.title, heading: HeadingLevel.HEADING_3 }));

          for (let l = 0; l < b.components.length; l++) {
            const c = b.components[l];

            // --- SYNCED COMPONENT HEADING (Line 1) ---
            const ctype = c.type || "(unknown)";
            const layout = c.layout || "";
            const headingLine = "Component: " + ctype + (layout ? " — " + layout : "");
            children.push(new Paragraph({ text: headingLine, heading: HeadingLevel.HEADING_4 }));

            // --- SYNCED COMPONENT TITLE (Line 2: Intense Quote) ---
            const compTitle = (c.title || c.displayTitle || "").trim();
            children.push(new Paragraph({
              text: compTitle || "(no component title)",
              style: "IntenseQuote"
            }));

            if (c.instruction) addLabelValue(children, "Instruction", c.instruction);
            if (c.body) {
              children.push(new Paragraph({ text: "Body Content:", bold: true }));
              children.push(new Paragraph(safeText(c.body)));
            }

            const typeKey = (c.type === "gmcq") ? "mcq" : c.type.toLowerCase();
            if (HANDLERS[typeKey]) HANDLERS[typeKey](children, c);

            await renderImages(c, assetMap, children);

            children.push(new Paragraph({
                text: "__________________________________________________________________",
                spacing: { before: 200, after: 400 }
            }));
          }
        }
      }
    }

    const doc = new Document({
      styles: {
        paragraphStyles: [
          { id: "Normal", name: "Normal", run: { font: "Arial", size: 22 } },
          { id: "Heading1", name: "Heading 1", run: { font: "Arial", size: 32, bold: true, color: "7030A0" } },
          { id: "Heading2", name: "Heading 2", run: { font: "Arial", size: 30, bold: true, color: "1F497D" } },
          { id: "Heading3", name: "Heading 3", run: { font: "Arial", size: 28, bold: true, color: "0070C0" } },
          { id: "Heading4", name: "Heading 4", run: { font: "Arial", size: 26, bold: true, color: "808240" } },
          // SYNCED INTENSE QUOTE STYLE
          {
            id: "IntenseQuote",
            name: "Intense Quote",
            run: { font: "Arial", size: 24, italic: true, color: "444444" },
            paragraph: { indent: { left: 400, right: 400 }, spacing: { before: 100, after: 100 } }
          }
        ]
      },
      sections: [{ children: children }]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFile(outputPath, buffer, function(err) {
      if (err) return done(err);
      done();
    });

  } catch (err) {
    done(err);
  }
};
