const fs = require("fs");
const {
  Document,
  Packer,
  Paragraph,
  HeadingLevel
} = require("docx");

const { safeText, addLabelValue } = require("./utils");
const HANDLERS = require("./handlers");
const { renderImages } = require("./images");

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
          text:
            "PAGE: " +
            (p.page && p.page.title ? p.page.title : "(no title)"),
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

            const ctype = c.type || c._component || "(unknown)";
            const layout = c.layout || c._layout || c._layoutName || "";
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
            const typeKey = (c.type || c._component || "").toString();
            if (typeKey && HANDLERS[typeKey]) {
              HANDLERS[typeKey](children, c);
            }

            // Images
            await renderImages(c, assetMap, children);

            // Separator
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
            run: { font: "Arial", size: 24, italic: true, color: "444444" },
            paragraph: {
              indent: { left: 400, right: 400 },
              spacing: { before: 100, after: 100 }
            }
          }
        ]
      },
      sections: [{ children }]
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
