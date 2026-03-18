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

/* ---------------------------------------------
   HTML → plain text
---------------------------------------------- */
function htmlToPlain(html) {
  if (!html) return "";
  return htmlToText.fromString(html, {
    wordwrap: false,
    ignoreHref: true,
    ignoreImage: true
  });
}

/* ---------------------------------------------
   1) Extract ANY filename ending in image extension
---------------------------------------------- */
function extractImageFilenames(obj) {
  const results = [];

  function walk(value) {
    if (!value) return;

    // string = check for image filename
    if (typeof value === "string") {
      if (value.match(/\.(png|jpg|jpeg|gif|svg)$/i)) {
        results.push(path.basename(value));
      }
      return;
    }

    // array
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    // object
    if (typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  }

  walk(obj);
  return [...new Set(results)];
}

/* ---------------------------------------------
   2) Match filenames to storyboard assets
---------------------------------------------- */
function findAssetsByFilenames(filenames, assetMap) {
  const list = Object.values(assetMap);
  return list.filter(a => filenames.includes(a.filename));
}

/* ---------------------------------------------
   3) Load image binary using filestorage
      Adapt 0.10.x uses:
        storage.createReadStream(asset.path)
---------------------------------------------- */
async function fetchImageBufferViaFileStorage(asset) {
  return new Promise((resolve, reject) => {
    filestorage.getStorage(asset.repository, (err, storage) => {
      if (err) return reject(err);

      try {
        storage.createReadStream(asset.path, (readStream) => {
          const chunks = [];

          readStream.on("data", chunk => chunks.push(chunk));
          readStream.on("end", () => resolve(Buffer.concat(chunks)));
          readStream.on("error", reject);
        });

      } catch (e) {
        reject(e);
      }
    });
  });
}

/* ---------------------------------------------
   4) Render ALL images detected inside component
---------------------------------------------- */
async function renderAnyImages(component, assetMap) {
  const filenames = extractImageFilenames(component);
  if (filenames.length === 0) return [];

  const assets = findAssetsByFilenames(filenames, assetMap);
  if (assets.length === 0) return [];

  const out = [new Paragraph("Images:")];

  for (const asset of assets) {
    let buffer;
    try {
      buffer = await fetchImageBufferViaFileStorage(asset);
    } catch (err) {
      console.log('Error loading image:', err);
      out.push(new Paragraph(`Could not load image for asset: ${asset._id}`));
      continue;
    }

    console.log("Image:", asset.filename, "Buffer length:", buffer.length);

    // Embed image
    out.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: buffer,
            transformation: { width: 400, height: 300 }
          })
        ]
      })
    );

    out.push(new Paragraph(`Filename: ${asset.filename}`));
    if (asset.description) {
      out.push(new Paragraph(`Description: ${asset.description}`));
    }
  }

  return out;
}

/* ---------------------------------------------
   5) Render structured MCQ content
---------------------------------------------- */
function renderStructuredComponent(component) {
  const out = [];

  if (Array.isArray(component._items)) {
    out.push(new Paragraph("Choices:"));
    component._items.forEach(i => {
      const mark = i._isCorrect ? " ✔" : "";
      out.push(new Paragraph(`- ${i.text || i.title || ""}${mark}`));
    });
  }

  if (component._feedback) {
    out.push(new Paragraph("Feedback:"));
    Object.entries(component._feedback).forEach(([key, val]) => {
      out.push(new Paragraph(`- ${key}: ${val}`));
    });
  }

  return out;
}

/* ---------------------------------------------
   6) Dump remaining component fields
---------------------------------------------- */
function objectToParagraphs(obj, indent = 0) {
  const out = [];
  const pad = "  ".repeat(indent);

  for (const key of Object.keys(obj)) {
    const val = obj[key];

    // skip internal noise
    if (
      key.startsWith("_") &&
      !["_component", "_items", "_feedback", "_graphic"].includes(key)
    ) continue;

    if (val === null || val === "" || val === undefined) continue;

    if (typeof val === "string") {
      out.push(new Paragraph(`${pad}${key}: ${val}`));
      continue;
    }

    if (Array.isArray(val)) {
      out.push(new Paragraph(`${pad}${key}:`));
      val.forEach((item, idx) => {
        if (typeof item === "string")
          out.push(new Paragraph(`${pad}- ${item}`));
        else {
          out.push(new Paragraph(`${pad}- Item ${idx + 1}:`));
          out.push(...objectToParagraphs(item, indent + 1));
        }
      });
      continue;
    }

    if (typeof val === "object") {
      out.push(new Paragraph(`${pad}${key}:`));
      out.push(...objectToParagraphs(val, indent + 1));
    }
  }

  return out;
}

/* ---------------------------------------------
   7) Render full component section
---------------------------------------------- */
async function renderComponent(component, assetMap) {
  const out = [];

  out.push(
    new Paragraph({
      text: `Component: ${component.title || component.displayTitle}`,
      heading: HeadingLevel.HEADING_4
    })
  );

  out.push(
    new Paragraph(`Type: ${component._component || component._type}`)
  );

  if (component.instruction)
    out.push(new Paragraph(`Instruction: ${component.instruction}`));

  if (component.body) {
    out.push(new Paragraph("Body:"));
    out.push(new Paragraph(htmlToPlain(component.body)));
  }

  out.push(...renderStructuredComponent(component));

  const imgs = await renderAnyImages(component, assetMap);
  out.push(...imgs);

  out.push(...objectToParagraphs(component));
  out.push(new Paragraph("-------------------------------"));

  return out;
}

/* ---------------------------------------------
   8) Main DOCX builder
---------------------------------------------- */
module.exports = async function buildDocx(data, outputPath, done) {
  try {
    const hierarchy = data._storyboardHierarchy || [];
    const assetMap = data._storyboardAssets || {};
    const courseTitle = data.course.title || "Storyboard Export";

    const children = [];

    children.push(
      new Paragraph({ text: courseTitle, heading: HeadingLevel.TITLE }),
      new Paragraph({
        text: "Course Storyboard Export",
        heading: HeadingLevel.HEADING_2
      })
    );

    // Walk course structure
    for (const pageWrap of hierarchy) {
      const page = pageWrap.page;

      children.push(
        new Paragraph({
          text: page.title,
          heading: HeadingLevel.HEADING_1
        })
      );

      for (const articleWrap of pageWrap.articles) {
        const article = articleWrap.article;

        children.push(
          new Paragraph({
            text: `Article: ${article.title}`,
            heading: HeadingLevel.HEADING_2
          })
        );

        for (const blockWrap of articleWrap.blocks) {
          const block = blockWrap.block;

          children.push(
            new Paragraph({
              text: `Block: ${block.title}`,
              heading: HeadingLevel.HEADING_3
            })
          );

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
