const fs = require('fs');

const renameVideoFile = async (oldPath, newPath) => {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.renameSync(oldPath, newPath, function (err) {
      if (err) {
        throw err;
      }
    });

    return true;
  } catch (e) {
    return false;
  }
};

module.exports.renameVideoFile = renameVideoFile;
