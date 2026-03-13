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
        // Extract collections
        const pages = sanitized.contentobject.filter(o => o._type === 'page');
        const articles = sanitized.article || [];
        const blocks = sanitized.block || [];
        const components = sanitized.component || [];

        // Helper map by parentId
        const articlesByPage = {};
        const blocksByArticle = {};
        const componentsByBlock = {};

        // Group articles by page
        pages.forEach(page => {
          articlesByPage[page._id] = articles.filter(a => a._parentId === page._id);
        });

        // Group blocks by article
        articles.forEach(article => {
          blocksByArticle[article._id] = blocks.filter(b => b._parentId === article._id);
        });

        // Group components by block
        blocks.forEach(block => {
          componentsByBlock[block._id] = components.filter(c => c._parentId === block._id);
        });

        // Create final hierarchical structure
        const hierarchy = pages.map(page => ({
          page,
          articles: (articlesByPage[page._id] || []).map(article => ({
            article,
            blocks: (blocksByArticle[article._id] || []).map(block => ({
              block,
              components: componentsByBlock[block._id] || []
            }))
          }))
        }));

        sanitized._storyboardHierarchy = hierarchy;
        cb();
      } catch (e) {
        cb(e);
      }
    },

    // 6. Retrieve all asset metadata for this course
    function storyboardRetrieveAssetMetadata(cb) {
      // Get DB
      database.getDatabase(function (err, db) {
        if (err) return cb(err);

        // Find all asset mappings for this course
        db.retrieve('courseasset',
          { _courseId: courseId, _contentType: { $ne: 'theme' } },
          function (err, results) {
            if (err) return cb(err);

            if (!results || results.length === 0) {
              sanitized._storyboardAssets = {}; // no assets
              return cb();
            }

            // We will build a map: assetId → asset record
            const assetIds = results.map(r => r._assetId);

            // Retrieve actual asset records
            const assetmanager = require('../../../lib/assetmanager');

            assetmanager.retrieveAsset(
              { _id: { $in: assetIds } },
              function (err, assets) {
                if (err) return cb(err);

                // Format asset lookup:
                // { assetId: { filename, path, repository, size, ... } }
                const map = {};
                assets.forEach(a => {
                  map[a._id] = a;
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
