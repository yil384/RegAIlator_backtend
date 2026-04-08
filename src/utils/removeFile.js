const fs = require('fs');

const logPathName = 'recordings';

const removeFile = async (filename) => {
  try {
    const filepath = `./${logPathName}/${filename}`;

    fs.unlinkSync(filepath);

    return true;
  } catch (e) {
    return false;
  }
};

module.exports.removeFile = removeFile;
