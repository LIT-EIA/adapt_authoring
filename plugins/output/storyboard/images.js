const path = require("path");
const { Paragraph, ImageRun, AlignmentType } = require("docx");
const filestorage = require("../../../lib/filestorage");
const sizeOf = require("image-size");
const { addLabelValue } = require("./utils");

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

      let width = 400;
      let height = 300;
      try {
        const dim = sizeOf(buffer);
        if (dim && dim.width && dim.height) {
          width = dim.width;
          height = dim.height;
          const MAX_WIDTH = 600;
          if (width > MAX_WIDTH) {
            const scale = MAX_WIDTH / width;
            width = MAX_WIDTH;
            height = Math.round(height * scale);
          }
        }
      } catch (e) {}

      let relpath = asset.path || "";
      relpath = relpath.trim().replace(/^[\/\\]+/, "").replace(/\\/g, "/");

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

module.exports = {
  renderImages
};
