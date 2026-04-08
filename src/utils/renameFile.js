const fs = require('fs');

const renameFile = async (oldPath, newPath) => {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.renameSync(oldPath, newPath);

    return true;
  } catch (e) {
    return false;
  }
};

module.exports = { renameFile, renameVideoFile: renameFile };
