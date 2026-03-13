const async = require('async');
const path = require('path');
const fs = require('fs-extra');

const { Constants } = require('../../../lib/outputmanager');
const database = require('../../../lib/database');
const usermanager = require('../../../lib/usermanager');
const outputHelpers = require('../adapt/outputHelpers'); // reuse validation & sortContentObjects
const logger = require('../../../lib/logger');

// Our docx builder (we will create this in the next step)
const buildDocx = require('./docxBuilder');

module.exports = function storyboard(courseId, mode, req, res, next) {
  const self = this;
  const user = usermanager.getCurrentUser();
  const tenantId = user.tenant._id;

  let courseJson = null;
  let sanitized = null;

  // target file path: temp/<tenant>/<course>/storyboard/<filename>.docx
  const temp = require('../../../lib/configuration').tempDir;
  const outputFolder = path.join(temp, tenantId.toString(), courseId.toString(), 'storyboard');

  async.waterfall([
    // 1. Ensure output folder exists
    function storyboardEnsureOutputFolder(cb) {
      fs.ensureDir(outputFolder, cb);
    },

    // 2. Retrieve raw JSON for the course
    function storyBoardRetrieveRawJSON(jsonData, cb) {
      self.getCourseJSON(tenantId, courseId, function (err, json) {
        if (err) return cb(err);
        courseJson = json;
        cb();
      });
    },

    // 3. Validate basic course structure (optional but recommended)
    function storyboardValidateCourseStructure(cb) {
      outputHelpers.validateCourse(courseJson, function (err, isValid) {
        if (err || !isValid) {
          return cb(new Error('Course structure invalid: ' + (err || 'unknown reason')));
        }
        cb();
      });
    },

    // 4. Sanitize JSON using Adapt’s logic
    function storyboardSanitizeJSON(cb) {
      self.sanitizeCourseJSON(Constants.Modes.Storyboard, courseJson, function (err, data) {
        if (err) return cb(err);
        sanitized = data;
        cb();
      });
    },

    // 5. Build ordered course hierarchy
    function storyboardBuildHierarchy(cb) {
      try {
        // Normalize ID and parentId values consistently as strings
        const norm = v => (v == null ? "" : v.toString());

        const pages = sanitized.contentobject.filter(o => o._type === "page");
        const articles = sanitized.article || [];
        const blocks = sanitized.block || [];
        const components = sanitized.component || [];

        const articlesByPage = {};
        const blocksByArticle = {};
        const componentsByBlock = {};

        // Group articles under pages
        pages.forEach(page => {
          const pageId = norm(page._id);
          articlesByPage[pageId] = articles.filter(a => norm(a._parentId) === pageId);
        });

        // Group blocks under articles
        articles.forEach(article => {
          const artId = norm(article._id);
          blocksByArticle[artId] = blocks.filter(b => norm(b._parentId) === artId);
        });

        // Group components under blocks
        blocks.forEach(block => {
          const blockId = norm(block._id);
          componentsByBlock[blockId] = components.filter(c => norm(c._parentId) === blockId);
        });

        // Build final hierarchy
        const hierarchy = pages.map(page => {
          const pageId = norm(page._id);

          return {
            page,
            articles: (articlesByPage[pageId] || []).map(article => {
              const artId = norm(article._id);

              return {
                article,
                blocks: (blocksByArticle[artId] || []).map(block => {
                  const blockId = norm(block._id);

                  return {
                    block,
                    components: componentsByBlock[blockId] || []
                  };
                })
              };
            })
          };
        });

        sanitized._storyboardHierarchy = hierarchy;
        cb();
      } catch (e) {
        cb(e);
      }
    },

    // 6. Retrieve all asset metadata for this course
    function storyboardRetrieveAssetMetadata(cb) {
      database.getDatabase(function (err, db) {
        if (err) return cb(err);

        db.retrieve(
          'courseasset',
          { _courseId: courseId, _contentType: { $ne: 'theme' } },
          function (err, results) {
            if (err) return cb(err);

            if (!results || results.length === 0) {
              sanitized._storyboardAssets = {};
              return cb();
            }

            const assetIds = results.map(r => r._assetId);
            const assetmanager = require('../../../lib/assetmanager');

            assetmanager.retrieveAsset(
              { _id: { $in: assetIds } },
              function (err, assets) {
                if (err) return cb(err);

                const config = require('../../../lib/configuration');
                const tenantAssetRoot = path.join(
                  config.tempDir,
                  tenantId.toString(),
                  "assets"
                );

                const map = {};

                assets.forEach(a => {
                  // Normalize the virtual DB path "\assets\e5\a5\..."
                  const cleaned = a.path.replace(/\\/g, path.sep);

                  // Build real filesystem path
                  const realPath = path.join(tenantAssetRoot, cleaned);

                  // Add realPath so docxBuilder can load the image
                  map[a._id] = {
                    ...a,
                    realPath
                  };
                });

                sanitized._storyboardAssets = map;
                cb();
              }
            );
          }
        );
      });
    },

    // 7. Generate DOCX file (call the docxBuilder)
    function storyboardGenerateDocx(cb) {
      try {
        const courseTitle = sanitized.course.title || 'course';
        const safeTitle = courseTitle.replace(/[\/\\?%*:|"<>]/g, '-'); // sanitize for filename

        const filename = `${safeTitle} - Storyboard.docx`;
        const filepath = path.join(outputFolder, filename);

        // Now call our builder
        buildDocx(sanitized, filepath, function (err) {
          if (err) return cb(err);

          // Store filename for final response
          sanitized._storyboardFile = {
            filename,
            path: filepath
          };
          cb();
        });

      } catch (e) {
        cb(e);
      }
    },

  ], function (err) {
    if (err) {
      logger.log('error', err);
      return next(err);
    }

    return next(null, {
      success: true,
      filename: sanitized._storyboardFile.filename
    });
  });
};
