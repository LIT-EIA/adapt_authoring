const fs = require('fs');
const { Document, Packer, Paragraph, HeadingLevel } = require('docx');

module.exports = function buildDocx(data, outputPath, done) {
  try {
    const hierarchy = data._storyboardHierarchy || [];
    const courseTitle = data.course.title || "Storyboard Export";

    // -------------------------------------------
    // CREATE CHILD PARAGRAPHS
    // -------------------------------------------
    const children = [];

    children.push(
      new Paragraph({
        text: courseTitle,
        heading: HeadingLevel.TITLE,
      })
    );

    children.push(
      new Paragraph({
        text: "Course Storyboard Export",
        heading: HeadingLevel.HEADING_2,
      })
    );

    // Add hierarchy contents
    hierarchy.forEach(pageWrapper => {
      const page = pageWrapper.page;

      children.push(
        new Paragraph({
          text: page.title || "Untitled Page",
          heading: HeadingLevel.HEADING_1,
        })
      );

      pageWrapper.articles.forEach(articleWrapper => {
        const article = articleWrapper.article;

        children.push(
          new Paragraph({
            text: "Article: " + (article.title || "Untitled Article"),
            heading: HeadingLevel.HEADING_2,
          })
        );

        articleWrapper.blocks.forEach(blockWrapper => {
          const block = blockWrapper.block;

          children.push(
            new Paragraph({
              text: "Block: " + (block.title || "Untitled Block"),
              heading: HeadingLevel.HEADING_3,
            })
          );

          blockWrapper.components.forEach(component => {
            children.push(
              new Paragraph({
                text: "- Component: " + (component._type || "Unknown Component"),
              })
            );
          });
        });
      });
    });

    // -------------------------------------------
    // DOCX v9+ DOCUMENT STRUCTURE (REQUIRED)
    // -------------------------------------------
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: children
        }
      ]
    });

    // -------------------------------------------
    // WRITE FILE
    // -------------------------------------------
    Packer.toBuffer(doc)
      .then(buffer => fs.writeFile(outputPath, buffer, done))
      .catch(done);

  } catch (err) {
    console.error("DOCX BUILDER ERROR:", err);
    done(err);
  }
};
