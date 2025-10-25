const fs = require('fs');

const logPathName = 'recordings';

const removeFile = async (filename) => {
  try {
    const filepath = `./${logPathName}/${filename}`;

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

module.exports.removeFile = removeFile;
