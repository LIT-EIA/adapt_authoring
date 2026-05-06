const fs = require("fs");
const {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun
} = require("docx");

const { safeText, addLabelValue } = require("./utils");
const HANDLERS = require("./handlers");
const polyglot = require('node-polyglot');
var origin = require('../../../lib/application');
var app = origin();

/* --- MAIN BUILDER --- */
module.exports = async function buildDocx(data, outputPath, done) {
  const defaultLocale = data.config ? data.config._defaultLanguage : "en";
  const locPolyglot = new polyglot({ phrases: app.polyglotPhrases[defaultLocale] });

  try {
    const children = [];
    const hierarchy = data._storyboardHierarchy || [];
    const assetMap = data._storyboardAssets || {};

    // Course title
    children.push(
      new Paragraph({
        spacing: { after: 100 },
        text: data.course && data.course.title ? data.course.title : `${locPolyglot.t('app.course')}`,
        heading: HeadingLevel.TITLE
      })
    );

    for (let i = 0; i < hierarchy.length; i++) {
      const p = hierarchy[i];
      children.push(
        new Paragraph({
          spacing: { after: 100 },
          text:
            "PAGE: " +
            (p.page && p.page.title ? p.page.title : `(${locPolyglot.t('app.notitle')})`),
          heading: HeadingLevel.HEADING_1
        })
      );

      for (let j = 0; j < p.articles.length; j++) {
        const a = p.articles[j];
        children.push(
          new Paragraph({
            spacing: { after: 100 },
            text:
              "Article: " +
              (a.article && a.article.title ? a.article.title : `(${locPolyglot.t('app.notitle')})`),
            heading: HeadingLevel.HEADING_2
          })
        );

        for (let k = 0; k < a.blocks.length; k++) {
          const b = a.blocks[k];
          children.push(
            new Paragraph({
              spacing: { after: 100 },
              text:
                `${locPolyglot.t('app.scaffold._level.block.variable')}: ` +
                (b.block && b.block.title ? b.block.title : `(${locPolyglot.t('app.notitle')})`),
              heading: HeadingLevel.HEADING_3
            })
          );

          for (let l = 0; l < b.components.length; l++) {
            const c = b.components[l];

            const ctype = c.type || c._component || `(${locPolyglot.t('app.unknown')})`;
            const layout = c.layout || c._layout || c._layoutName || "";
            const layoutKey = layout ? `app.layout${layout}` : "";
            const headingLine =
              `${locPolyglot.t('app.scaffold._level.component.variable')} ` + ctype + (layout ? " — " + locPolyglot.t(layoutKey) : "");
            children.push(
              new Paragraph({
                spacing: { after: 100 },
                text: headingLine,
                heading: HeadingLevel.HEADING_4
              })
            );

            // Component title (Intense Quote)
            const compTitle = safeText(c.title || c.displayTitle || "");
            children.push(
              new Paragraph({
                spacing: { before: 100, after: 100 },
                heading: HeadingLevel.HEADING_5,
                children: [
                  new TextRun({
                    text: compTitle || `(${locPolyglot.t('app.notitle')})`,
                    font: "Arial",
                    size: 24,
                    italic: true,
                    bold: true,
                    underline: true,
                    color: "4472C4"
                  })
                ]
              })
            );

            const bodyRaw = c.body || "";
            addLabelValue(
              children,
              locPolyglot.t('app.bodytext'),
              bodyRaw ? bodyRaw : `(${locPolyglot.t('app.scaffold._bubbledirection.none.variable')})`
            );

            const instrRaw = c.instruction || "";
            addLabelValue(
              children,
              "Instructions",
              instrRaw ? instrRaw : `(${locPolyglot.t('app.scaffold._bubbledirection.none.variable')})`
            );

            // Component-specific handler
            const typeKey = (c.type || c._component || "").toString();
            if (typeKey && HANDLERS[typeKey]) {
              await HANDLERS[typeKey](children, c, assetMap, locPolyglot);
            }

            // Separator
            children.push(
              new Paragraph({
                spacing: { after: 100 },
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
            run: { font: "Arial", size: 24, italic: true, bold: true, underline: true, color: "4472C4" },
            paragraph: {
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
