const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  ImageRun
} = require("docx");

const filestorage = require("../../../lib/filestorage");
const htmlToText = require("html-to-text");
const sizeOf = require("image-size");

/* ---------------------------------------------
   UNIVERSAL XML-SAFE TEXT SANITIZER
---------------------------------------------- */
function safeText(str) {
  if (!str || typeof str !== "string") return "";

  return str
    // remove all illegal XML chars
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    // remove bidirectional text markers that break Word
    .replace(/[\u202A-\u202E]/g, "")
    // remove replacement character
    .replace(/\uFFFD/g, "")
    .trim();
}

/* Safe wrapper for Paragraphs to catch bad text early */
function safeParagraph(text, opts = {}) {
  return new Paragraph({
    ...opts,
    text: safeText(text)
  });
}

/* ---------------------------------------------
   HTML → plain text (sanitized)
---------------------------------------------- */
function htmlToPlain(html) {
  if (!html) return "";
  const out = htmlToText.fromString(html, {
    wordwrap: false,
    ignoreHref: true,
    ignoreImage: true
  });
  return safeText(out);
}

/* ---------------------------------------------
   Extract image filenames from any object
---------------------------------------------- */
function extractImageFilenames(obj) {
  const results = [];

  function walk(value) {
    if (!value) return;

    if (typeof value === "string") {
      if (value.match(/\.(png|jpe?g|gif|svg)$/i)) {
        results.push(path.basename(value));
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    if (typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  }

  walk(obj);
  return [...new Set(results)];
}

/* ---------------------------------------------
   Match filenames to storyboard assets
---------------------------------------------- */
function findAssetsByFilenames(filenames, assetMap) {
  return Object.values(assetMap).filter(a => filenames.includes(a.filename));
}

/* ---------------------------------------------
   Correct + Safe Asset Stream Loader
---------------------------------------------- */
async function fetchImageBufferViaFileStorage(asset) {
  return new Promise((resolve, reject) => {
    filestorage.getStorage(asset.repository, (err, storage) => {
      if (err) return reject(err);

      // Use safe, atomic file read — avoids all stream corruption
      storage.getFileContents(asset.path, (err, buffer) => {
        if (err) return reject(err);
        resolve(buffer);
      });
    });
  });
}

/* ---------------------------------------------
   Render embedded images
---------------------------------------------- */
async function renderAnyImages(component, assetMap) {
  const filenames = extractImageFilenames(component);
  if (filenames.length === 0) return [];

  const assets = findAssetsByFilenames(filenames, assetMap);
  if (assets.length === 0) return [];

  const out = [safeParagraph("Images:")];

  for (const asset of assets) {

    const lower = asset.filename.toLowerCase();

    if (lower.endsWith(".svg")) {
      out.push(safeParagraph(`(SVG not supported in DOCX) ${asset.filename}`));
      continue;
    }

    // Explicit type (CRITICAL FIX)
    let imgType = "jpg";
    if (lower.endsWith(".png")) imgType = "png";
    if (lower.endsWith(".gif")) imgType = "gif";

    let buffer;

    try {
      buffer = await fetchImageBufferViaFileStorage(asset);

      if (!Buffer.isBuffer(buffer)) {
        throw new Error("Image data is not a valid Buffer");
      }

      // Remove UTF-8 BOM if present
      if (buffer.length > 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        buffer = buffer.slice(3);
      }

      // Normalize Buffer (fixes odd ArrayBuffer cases)
      buffer = Buffer.from(buffer);

    } catch (err) {
      console.error("Error loading image:", err);
      out.push(safeParagraph(`Could not load image: ${asset.filename}`));
      continue;
    }

    // ---- SAFE DIMENSION HANDLING ----
    let width = 400;
    let height = 300;

    try {
      const dim = sizeOf(buffer);

      if (!dim || !dim.width || !dim.height) {
        throw new Error("Invalid image dimensions");
      }

      width = dim.width;
      height = dim.height;

      // Constrain maximum width
      const MAX_WIDTH = 600;
      if (width > MAX_WIDTH) {
        const scale = MAX_WIDTH / width;
        width = MAX_WIDTH;
        height = Math.round(height * scale);
      }

    } catch (e) {
      console.warn("Could not detect dimensions:", e);
      // Keep defaults
    }

    // ---- IMAGE INSERTION ----
    out.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: buffer,
            type: imgType, // CRITICAL
            transformation: { width, height }
          })
        ]
      })
    );

    out.push(safeParagraph(`Filename: ${asset.filename}`));
    if (asset.description) {
      out.push(safeParagraph(`Description: ${safeText(asset.description)}`));
    }
  }

  return out;
}

/* ---------------------------------------------
   Render MCQ fields
---------------------------------------------- */
function renderStructuredComponent(component) {
  const out = [];

  if (Array.isArray(component._items)) {
    out.push(safeParagraph("Choices:"));
    component._items.forEach(i => {
      const mark = i._isCorrect ? " ✔" : "";
      out.push(
        safeParagraph(`- ${safeText(i.text || i.title || "")}${mark}`)
      );
    });
  }

  if (component._feedback) {
    out.push(safeParagraph("Feedback:"));
    Object.entries(component._feedback).forEach(([key, val]) => {
      out.push(safeParagraph(`- ${safeText(key)}: ${safeText(val)}`));
    });
  }

  return out;
}

/* ---------------------------------------------
   Dump remaining component fields (safe)
---------------------------------------------- */
function objectToParagraphs(obj, indent = 0) {
  const out = [];
  const pad = "  ".repeat(indent);

  for (const key of Object.keys(obj)) {
    const val = obj[key];

    if (
      key.startsWith("_") &&
      !["_component", "_items", "_feedback", "_graphic"].includes(key)
    ) continue;

    if (val === null || val === "" || val === undefined) continue;

    if (typeof val === "string") {
      out.push(safeParagraph(`${pad}${safeText(key)}: ${safeText(val)}`));
      continue;
    }

    if (Array.isArray(val)) {
      out.push(safeParagraph(`${pad}${safeText(key)}:`));
      val.forEach((item, idx) => {
        if (typeof item === "string")
          out.push(safeParagraph(`${pad}- ${safeText(item)}`));
        else {
          out.push(safeParagraph(`${pad}- Item ${idx + 1}:`));
          out.push(...objectToParagraphs(item, indent + 1));
        }
      });
      continue;
    }

    if (typeof val === "object") {
      out.push(safeParagraph(`${pad}${safeText(key)}:`));
      out.push(...objectToParagraphs(val, indent + 1));
    }
  }

  return out;
}

/* ---------------------------------------------
   Render entire component section
---------------------------------------------- */
async function renderComponent(component, assetMap) {
  const out = [];

  out.push(
    safeParagraph(
      `Component: ${safeText(component.title || component.displayTitle)}`,
      { heading: HeadingLevel.HEADING_4 }
    )
  );

  out.push(
    safeParagraph(
      `Type: ${safeText(component._component || component._type)}`
    )
  );

  if (component.instruction)
    out.push(safeParagraph(`Instruction: ${safeText(component.instruction)}`));

  if (component.body) {
    out.push(safeParagraph("Body:"));
    out.push(safeParagraph(htmlToPlain(component.body)));
  }

  if (component.type === "dnd-multiple") {
    out.push(safeParagraph("DND Items:", { bold: true }));

    for (const item of component.items || []) {
      out.push(safeParagraph(`• ${item.title}`));

      // Options inside each item
      for (const opt of item.options || []) {
        out.push(safeParagraph(`   - ${opt.title}`));

        // If graphic exists, print details AND embed image
        if (opt.graphic && opt.graphic.src) {
          out.push(safeParagraph(`     Image: ${opt.graphic.src}`));

          // ✅ Try embedding the image just like other components
          const filenames = [path.basename(opt.graphic.src)];
          const assets = findAssetsByFilenames(filenames, assetMap);

          if (assets.length > 0) {
            const embed = await renderAnyImages({ _graphic: { src: opt.graphic.src } }, assetMap);
            out.push(...embed);
          }

          if (opt.graphic.alt) {
            out.push(safeParagraph(`     Alt: ${opt.graphic.alt}`));
          }
        }
      }
    }

    if (component.feedback) {
      out.push(safeParagraph("Feedback:", { bold: true }));
      out.push(safeParagraph(`Correct: ${component.feedback.correct}`));
      out.push(safeParagraph(`Incorrect (final): ${component.feedback.incorrect_final}`));
      out.push(safeParagraph(`Incorrect (not final): ${component.feedback.incorrect_notFinal}`));
      out.push(safeParagraph(`Partly Correct (final): ${component.feedback.partly_final}`));
      out.push(safeParagraph(`Partly Correct (not final): ${component.feedback.partly_notFinal}`));
    }
  }

  out.push(...renderStructuredComponent(component));

  const imgs = await renderAnyImages(component, assetMap);
  out.push(...imgs);

  out.push(...objectToParagraphs(component));

  out.push(safeParagraph("-------------------------------"));

  return out;
}

/* ---------------------------------------------
   Main DOCX builder
---------------------------------------------- */
module.exports = async function buildDocx(data, outputPath, done) {
  try {
    const hierarchy = data._storyboardHierarchy || [];
    const assetMap = data._storyboardAssets || {};
    const courseTitle = safeText(data.course.title || "Storyboard Export");

    const children = [];

    children.push(
      safeParagraph(courseTitle, { heading: HeadingLevel.HEADING_1 }),
      safeParagraph("Course Storyboard Export", {
        heading: HeadingLevel.HEADING_2
      })
    );

    for (const pageWrap of hierarchy) {
      const page = pageWrap.page;

      children.push(
        safeParagraph(safeText(page.title), {
          heading: HeadingLevel.HEADING_1
        })
      );

      if (page.instruction)
        children.push(safeParagraph(`Instruction: ${page.instruction}`));

      if (page.body) {
        children.push(safeParagraph("Body:"));
        children.push(safeParagraph(page.body));
      }

      if (page.pageBody) {
        children.push(safeParagraph("Page Body:"));
        children.push(safeParagraph(page.pageBody));
      }

      for (const articleWrap of pageWrap.articles) {
        const article = articleWrap.article;

        children.push(
          safeParagraph(`Article: ${safeText(article.title)}`, {
            heading: HeadingLevel.HEADING_2
          })
        );

        if (article.instruction)
          children.push(safeParagraph(`Instruction: ${article.instruction}`));

        if (article.body) {
          children.push(safeParagraph("Body:"));
          children.push(safeParagraph(article.body));
        }

        for (const blockWrap of articleWrap.blocks) {
          const block = blockWrap.block;

          children.push(
            safeParagraph(`Block: ${safeText(block.title)}`, {
              heading: HeadingLevel.HEADING_3
            })
          );

          if (block.instruction)
            children.push(safeParagraph(`Instruction: ${block.instruction}`));

          if (block.body) {
            children.push(safeParagraph("Body:"));
            children.push(safeParagraph(block.body));
          }

          for (const component of blockWrap.components) {
            const compNodes = await renderComponent(component, assetMap);
            children.push(...compNodes);
          }
        }
      }
    }

    const doc = new Document({
      sections: [{ children }]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFile(outputPath, buffer, done);

  } catch (err) {
    console.error("DOCX BUILDER ERROR:", err);
    done(err);
  }
};
