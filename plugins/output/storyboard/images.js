const path = require("path");
const { Paragraph, ImageRun, AlignmentType } = require("docx");
const filestorage = require("../../../lib/filestorage");
const sizeOf = require("image-size");
const { addLabelValue, safeText } = require("./utils");

/* --- IMAGE HANDLER --- */
async function renderImages(component, assetMap, children) {
  const findAssets = (obj) => {
    const found = [];
    const walk = (v) => {
      if (typeof v === "string" && v.indexOf("course/assets/") !== -1) {
        found.push(path.basename(v));
      } else if (v && typeof v === "object") {
        Object.keys(v).forEach(k => walk(v[k]));
      }
    };
    walk(obj);
    return found.filter((item, pos) => found.indexOf(item) === pos);
  };

  const filenames = findAssets(component);
  const assets = Object.keys(assetMap)
    .map(key => assetMap[key])
    .filter(a => filenames.indexOf(a.filename) !== -1);

  const altText =
    component &&
      component._graphic &&
      typeof component._graphic.alt === "string" &&
      component._graphic.alt.trim()
      ? component._graphic.alt.trim()
      : "";

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    try {
      let buffer = await new Promise((resolve, reject) => {
        filestorage.getStorage(asset.repository, function (err, s) {
          if (err) return reject(err);
          s.getFileContents(asset.path, function (e, b) {
            return e ? reject(e) : resolve(b);
          });
        });
      });

      if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);

      if (
        buffer.length > 3 &&
        buffer[0] === 0xEF &&
        buffer[1] === 0xBB &&
        buffer[2] === 0xBF
      ) {
        buffer = buffer.slice(3);
      }

      const lower = asset.filename.toLowerCase();
      let imgType = "jpg";
      if (lower.endsWith(".png")) imgType = "png";
      else if (lower.endsWith(".gif")) imgType = "gif";
      else if (lower.endsWith(".jpeg")) imgType = "jpg";

      if (lower.endsWith(".svg")) continue;

      const TARGET_WIDTH = 336;

      let width = TARGET_WIDTH;
      let height = 200; // fallback

      try {
        const dim = sizeOf(buffer);
        if (dim && dim.width && dim.height) {
          const scale = TARGET_WIDTH / dim.width;
          width = TARGET_WIDTH;
          height = Math.round(dim.height * scale);
        }
      } catch (e) { }

      let relpath = asset.path || "";
      relpath = relpath.trim().replace(/^[\/\\]+/, "").replace(/\\/g, "/");

      children.push(
        new Paragraph({ spacing: { before: 400 }, text: "" })
      );

      addLabelValue(children, "Adapt Image File SCORM Location", relpath || "(none)");

      const title = (asset.title || "").trim();
      const desc = (asset.description || "").trim();
      let originalLine = title || asset.filename;
      if (desc) {
        originalLine += " Image Description in Metatag: " + desc;
      }
      addLabelValue(children, "Original Image file Adapt Asset Name", originalLine);

      addLabelValue(children, "Alt text", altText || "(none)");

      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new ImageRun({
              data: buffer,
              type: imgType,
              transformation: { width, height }
            })
          ]
        })
      );

      children.push(new Paragraph({ text: "" }));
    } catch (e) {
      addLabelValue(
        children,
        "Image embed warning",
        "Could not embed image: " + asset.filename
      );
    }
  }
}

/* Normalize Adapt/SCORM asset paths */
function normalizeSrc(src) {
  if (!src) return "";

  // Remove query params
  src = src.split("?")[0];

  // Normalize slashes
  src = src.replace(/\\/g, "/");

  // Remove leading ./ or ../
  src = src.replace(/^(\.\/|\.\.\/)+/, "");

  // Ensure we anchor at course/assets/
  const idx = src.indexOf("course/assets/");
  if (idx !== -1) {
    src = src.substring(idx);
  }

  return src.trim();
}

async function addImageBlock(children, src, altText, assetMap, locPolyglot) {
  if (!src) {
    addLabelValue(children, locPolyglot.t('app.adaptfilescormlocation'), `(${locPolyglot.t('app.scaffold._bubbledirection.none.variable')})`);
    return;
  }
  addLabelValue(children, locPolyglot.t('app.graphic.source'), src);
  if (altText) addLabelValue(children, locPolyglot.t('app.graphic.alt'), altText);

  // Normalize the incoming src so it matches assetMap entries
  const normalized = normalizeSrc(src);
  const filename = path.basename(normalized);

  // Find the asset by filename
  const asset = Object.values(assetMap).find(a => a.filename === filename);

  if (!asset) {
    addLabelValue(children, locPolyglot.t('app.adaptfilescormlocation'), normalized);
    addLabelValue(children, locPolyglot.t('app.imageembedwarning'), locPolyglot.t('app.imagefilenotfound'));
    return;
  }

  // Load binary data from filestorage
  let buffer = await new Promise((resolve, reject) => {
    filestorage.getStorage(asset.repository, (err, storage) => {
      if (err) return reject(err);
      storage.getFileContents(asset.path, (e, data) => {
        if (e) reject(e);
        else resolve(data);
      });
    });
  });

  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);

  // Strip UTF‑8 BOM if present
  if (
    buffer.length > 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf
  ) {
    buffer = buffer.slice(3);
  }

  const lower = asset.filename.toLowerCase();

  // Skip SVGs (docx cannot embed them)
  if (lower.endsWith(".svg")) {
    addLabelValue(children, locPolyglot.t('app.imageembedwarning'), locPolyglot.t('app.svgimagecannotbeembedded', { filename: asset.filename }));
    return;
  }

  // Determine image type
  let imgType = "jpg";
  if (lower.endsWith(".png")) imgType = "png";
  else if (lower.endsWith(".gif")) imgType = "gif";
  else if (lower.endsWith(".jpeg")) imgType = "jpg";

  const TARGET_WIDTH = 336;
  let width = TARGET_WIDTH;
  let height = 200; // fallback

  try {
    const dim = sizeOf(buffer);
    if (dim && dim.width && dim.height) {
      const scale = TARGET_WIDTH / dim.width;
      width = TARGET_WIDTH;
      height = Math.round(dim.height * scale);
    }
  } catch (e) {
    // Keep fallback height
  }

  children.push(
    new Paragraph({ spacing: { before: 300 }, text: "" })
  );

  addLabelValue(children, locPolyglot.t('app.adaptfilescormlocation'), asset.path || `(${locPolyglot.t('app.scaffold._bubbledirection.none.variable')})`);

  const title = safeText(asset.title || "");
  const desc = safeText(asset.description || "");
  let originalLine = title || asset.filename;
  if (desc) originalLine += ` ${locPolyglot.t('app.imagedescriptioninmetatag')}: ` + desc;

  addLabelValue(children, locPolyglot.t('app.originalimagefileadaptassetname'), originalLine);
  addLabelValue(children, locPolyglot.t('app.alttext'), altText || `(${locPolyglot.t('app.scaffold._bubbledirection.none.variable')})`);

  // Embed the image
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new ImageRun({
          data: buffer,
          type: imgType,
          transformation: { width, height }
        })
      ]
    })
  );

  children.push(new Paragraph({ spacing: { after: 100 }, text: "" }));

}

module.exports = {
  renderImages,
  addImageBlock
};
