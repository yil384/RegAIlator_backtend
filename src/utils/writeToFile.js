const fs = require('fs');
const moment = require('moment');
const config = require('../configs/config');

const logPathName = 'recordings';

const writeToFile = async (records, username) => {
  try {
    const filename = `${username.toUpperCase()}_${moment().format('YYYYMMDD_HHMMSS')}.json`;
    const fileHostPath = `${config.api_host}/${logPathName}/${filename}`;
    const logPath = `./${logPathName}/`;
    const filepath = `./${logPathName}/${filename}`;

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!fs.existsSync(logPath)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.mkdirSync(logPath, { recursive: true });
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.writeFileSync(filepath, JSON.stringify(records, null, 1), function (err) {
      // fs.writeFile(filepath, JSON.stringify(records, null, 1), function (err) {
      if (err) {
        throw err;
      }
    });

    return {
      filename,
      filepath,
      fileHostPath,
    };
  } catch (e) {
    return false;
  }
};

module.exports.writeToFile = writeToFile;
