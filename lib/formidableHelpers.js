// LICENCE https://github.com/adaptlearning/adapt_authoring/blob/master/LICENSE
/**
 * formidable v3 changed its parse() output shape compared to the v1/v2 API
 * this app was originally written against:
 *   - every `fields` value is now an array of strings (even for a single value)
 *   - every `files` value is now an array of File objects (even for a single file)
 *   - File objects were renamed: `.path` -> `.filepath`, `.name` -> `.originalFilename`,
 *     `.type` -> `.mimetype`
 *
 * These helpers restore the old, single-value shape (and old File property
 * names as aliases) so existing callback code that assumes the v1/v2 shape
 * continues to work without change.
 */

/**
 * Returns the first element if passed an array, otherwise returns the value as-is.
 */
function firstOrSelf(value) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Adds back-compat property aliases to a formidable v3 File object in place.
 */
function normalizeFile(file) {
  if (!file || 'object' !== typeof file) {
    return file;
  }
  if (file.filepath !== undefined && file.path === undefined) {
    file.path = file.filepath;
  }
  if (file.originalFilename !== undefined && file.name === undefined) {
    file.name = file.originalFilename;
  }
  if (file.mimetype !== undefined && file.type === undefined) {
    file.type = file.mimetype;
  }
  return file;
}

/**
 * Normalizes the (fields, files) result of formidable's form.parse() back to
 * the old v1/v2 shape: single values instead of arrays, and old File property
 * names available as aliases.
 *
 * @param {object} fields
 * @param {object} files
 * @return {{fields: object, files: object}}
 */
function normalizeFormResult(fields, files) {
  var normalizedFields = {};
  Object.keys(fields || {}).forEach(function (key) {
    normalizedFields[key] = firstOrSelf(fields[key]);
  });

  var normalizedFiles = {};
  Object.keys(files || {}).forEach(function (key) {
    normalizedFiles[key] = normalizeFile(firstOrSelf(files[key]));
  });

  return { fields: normalizedFields, files: normalizedFiles };
}

exports.firstOrSelf = firstOrSelf;
exports.normalizeFile = normalizeFile;
exports.normalizeFormResult = normalizeFormResult;
