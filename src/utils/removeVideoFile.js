const fs = require('fs');

const removeFile = async (filepath) => {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.unlinkSync(filepath);

    return true;
  } catch (e) {
    return false;
  }
};

module.exports = { removeFile, removeVideoFile: removeFile };
