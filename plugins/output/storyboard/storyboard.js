const async = require('async');
const path = require('path');
const fs = require('fs-extra');

const { Constants } = require('../../../lib/outputmanager');
const database = require('../../../lib/database');
const usermanager = require('../../../lib/usermanager');
const outputHelpers = require('../adapt/outputHelpers');
const logger = require('../../../lib/logger');
const config = require('../../../lib/configuration');

// Updated Builder and Cleaners
const buildDocx = require('./docxBuilder');
const {
  cleanPage,
  cleanArticle,
  cleanBlock,
  cleanComponent
} = require("./cleaners");

module.exports = function storyboard(courseId, mode, req, res, next) {
  const self = this;
  const user = usermanager.getCurrentUser();
  const tenantId = user.tenant._id;

  let courseJson = null;
  let sanitized = null;

  const tempDir = config.tempDir;
  const outputFolder = path.join(tempDir, tenantId.toString(), Constants.Folders.Exports, 'storyboard', user._id);

  async.waterfall([
    // 1. Prepare Environment
    function storyboardEnsureOutputFolder(cb) {
      fs.ensureDir(outputFolder, cb);
    },

    // 2. Get Raw Course Data
    function storyBoardRetrieveRawJSON(jsonData, cb) {
      self.getCourseJSON(tenantId, courseId, function (err, json) {
        if (err) return cb(err);
        courseJson = json;
        cb();
      });
    },

    // 3. Validation
    function storyboardValidateCourseStructure(cb) {
      outputHelpers.validateCourse(courseJson, function (err, isValid) {
        if (err || !isValid) {
          return cb(new Error('Course structure invalid: ' + (err || 'unknown reason')));
        }
        cb();
      });
    },

    // 4. Adapt-Standard Sanitization
    function storyboardSanitizeJSON(cb) {
      self.sanitizeCourseJSON(Constants.Modes.Storyboard, courseJson, function (err, data) {
        if (err) return cb(err);
        sanitized = data;
        cb();
      });
    },

    // 5. Build Hierarchy (The "Glue" between Database and Storyboard)
    function storyboardBuildHierarchy(cb) {
      try {
        const norm = v => (v == null ? "" : v.toString());

        const pages = sanitized.contentobject.filter(o => o._type === "page");
        const articles = sanitized.article || [];
        const blocks = sanitized.block || [];
        const components = sanitized.component || [];

        // console.log("build ordered course hierarchy sanitized:");
        // console.dir(sanitized, { depth: null, colors: true });

        // Map children to parents
        sanitized._storyboardHierarchy = pages.map(p => {
          const pid = norm(p._id);

          return {
            page: cleanPage(p), // Now preserves _graphic for the builder
            articles: articles.filter(a => norm(a._parentId) === pid).map(a => {
              const aid = norm(a._id);

              return {
                article: cleanArticle(a),
                blocks: blocks.filter(b => norm(b._parentId) === aid).map(b => {
                  const bid = norm(b._id);

                  return {
                    block: cleanBlock(b),
                    // Crucial Change: cleanComponent now keeps the data needed for MCQ/Talk/Sim
                    components: components.filter(c => norm(c._parentId) === bid).map(cleanComponent)
                  };
                })
              };
            })
          };
        });

        cb();
      } catch (e) {
        cb(e);
      }
    },

    // 6. Map Assets (Real Server Paths)
    function storyboardRetrieveAssetMetadata(cb) {
      database.getDatabase(function (err, db) {
        if (err) return cb(err);

        db.retrieve("courseasset", { _courseId: courseId, _contentType: { $ne: "theme" } }, function (err, mappings) {
          if (err) return cb(err);
          if (!mappings || mappings.length === 0) {
            sanitized._storyboardAssets = {};
            return cb();
          }

          const assetIds = mappings.map(m => m._assetId);
          const assetmanager = require("../../../lib/assetmanager");
          const tenantAssetRoot = path.join(config.tempDir, tenantId.toString(), "assets");

          assetmanager.retrieveAsset({ _id: { $in: assetIds } }, function (err, assets) {
            if (err) return cb(err);

            const map = {};
            assets.forEach(a => {
              const raw = a._doc || a;
              const cleanedPath = raw.path.replace(/\\/g, path.sep);

              map[raw._id.toString()] = {
                _id: raw._id.toString(),
                filename: raw.filename,
                path: raw.path,
                title: raw.title,
                description: raw.description,
                repository: raw.repository,
                realPath: path.join(tenantAssetRoot, cleanedPath)
              };
            });

            sanitized._storyboardAssets = map;
            cb();
          });
        });
      });
    },

    // 7. Generate Document
    function storyboardGenerateDocx(cb) {
      const courseTitle = sanitized.course.title || 'course';
      const safeTitle = courseTitle.replace(/[\/\\?%*:|"<>]/g, '-');
      const filename = `${safeTitle}.docx`;
      const filepath = path.join(outputFolder, filename);

      // Call the refactored Builder
      buildDocx(sanitized, filepath, function (err) {
        if (err) return cb(err);

        sanitized._storyboardFile = { filename, path: filepath };
        cb();
      });
    }

  ], function (err) {
    if (err) {
      logger.log('error', err);
      return next(err);
    }
    // Return final success with the filename for the UI
    return next(null, {
      success: true,
      filename: sanitized._storyboardFile.filename
    });
  });
};
