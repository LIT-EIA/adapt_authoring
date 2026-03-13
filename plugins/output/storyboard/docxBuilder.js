const fs = require("fs");
const path = require("path");
const {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  ImageRun
} = require("docx");

// Use html-to-text v8 (compatible w/ Node 12/14)
const htmlToText = require("html-to-text");

// Convert HTML to plain text
function htmlToPlain(html) {
  if (!html) return "";
  return htmlToText.fromString(html, {
    wordwrap: false,
    ignoreHref: true,
    ignoreImage: true
  });
}

// Render all key/value pairs of a component
function objectToParagraphs(obj, indent = 0) {
  const out = [];
  const pad = "  ".repeat(indent);

  for (const key of Object.keys(obj)) {
    const val = obj[key];

    // Skip noisy internal keys
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
        if (typeof item === "string") {
          out.push(new Paragraph(`${pad}- ${item}`));
        } else {
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

// Render images (embed if readable)
function renderImage(component, assetMap) {
  if (!component._graphic || !component._graphic.src) return [];

  const assetId = component._graphic.src;
  const asset = assetMap[assetId];

  if (!asset) {
    return [
      new Paragraph("Image (metadata missing)"),
      new Paragraph(`Asset ID: ${assetId}`)
    ];
  }

  const fullPath = asset.realPath;

  let imgBuffer;
  try {
    imgBuffer = fs.readFileSync(fullPath);
  } catch (e) {
    return [
      new Paragraph("Image could not be loaded"),
      new Paragraph(`Path tried: ${fullPath}`)
    ];
  }

  return [
    new Paragraph("Image:"),
    new Paragraph({
      children: [
        new ImageRun({
          data: imgBuffer,
          transformation: { width: 400, height: 300 }
        })
      ]
    }),
    new Paragraph(`Filename: ${asset.filename}`),
    new Paragraph(`Description: ${asset.description || ""}`)
  ];
}

// Render MCQ & other structured fields
function renderStructuredComponent(component) {
  const out = [];

  if (Array.isArray(component._items)) {
    out.push(new Paragraph("Choices:"));
    component._items.forEach(i => {
      const mark = i._isCorrect ? " ✔" : "";
      out.push(new Paragraph(`- ${i.text || i.title}${mark}`));
    });
  }

  if (component._feedback) {
    out.push(new Paragraph("Feedback:"));
    Object.keys(component._feedback).forEach(key => {
      out.push(new Paragraph(`- ${key}: ${component._feedback[key]}`));
    });
  }

  return out;
}

// Render a single component section
function renderComponent(component, assetMap) {
  const out = [];

  out.push(
    new Paragraph({
      text: `Component: ${component.title || component.displayTitle}`,
      heading: HeadingLevel.HEADING_4
    })
  );

  out.push(new Paragraph(`Type: ${component._component || component._type}`));

  if (component.instruction) {
    out.push(new Paragraph(`Instruction: ${component.instruction}`));
  }

  if (component.body) {
    out.push(new Paragraph("Body:"));
    out.push(new Paragraph(htmlToPlain(component.body)));
  }

  out.push(...renderStructuredComponent(component));
  out.push(...renderImage(component, assetMap));
  out.push(...objectToParagraphs(component));

  out.push(new Paragraph("-------------------------------"));
  return out;
}

// MAIN DOCX BUILDER
module.exports = function buildDocx(data, outputPath, done) {
  try {
    const hierarchy = data._storyboardHierarchy || [];
    const assetMap = data._storyboardAssets || {};
    const courseTitle = data.course.title || "Storyboard Export";

    const sections = [];

    sections.push(
      new Paragraph({ text: courseTitle, heading: HeadingLevel.TITLE }),
      new Paragraph({ text: "Course Storyboard Export", heading: HeadingLevel.HEADING_2 })
    );

    hierarchy.forEach(pageWrap => {
      const page = pageWrap.page;

      sections.push(
        new Paragraph({
          text: page.title || "Untitled Page",
          heading: HeadingLevel.HEADING_1
        })
      );

      pageWrap.articles.forEach(articleWrap => {
        const article = articleWrap.article;

        sections.push(
          new Paragraph({
            text: `Article: ${article.title}`,
            heading: HeadingLevel.HEADING_2
          })
        );

        articleWrap.blocks.forEach(blockWrap => {
          const block = blockWrap.block;

          sections.push(
            new Paragraph({
              text: `Block: ${block.title}`,
              heading: HeadingLevel.HEADING_3
            })
          );

          blockWrap.components.forEach(component => {
            sections.push(...renderComponent(component, assetMap));
          });
        });
      });
    });

    const doc = new Document({
      sections: [{ children: sections }]
    });

    Packer.toBuffer(doc)
      .then(buffer => fs.writeFile(outputPath, buffer, done))
      .catch(done);

  } catch (err) {
    console.error("DOCX BUILDER ERROR:", err);
    done(err);
  }
};
