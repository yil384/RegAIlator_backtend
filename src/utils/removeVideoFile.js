const fs = require('fs');

const removeVideoFile = async (filepath) => {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.unlinkSync(filepath, function (err) {
      if (err) {
        throw err;
      }
    });

    return true;
  } catch (e) {
    return false;
  }
};

module.exports.removeVideoFile = removeVideoFile;
