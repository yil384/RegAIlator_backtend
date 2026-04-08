const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createWatchLog = {
  body: Joi.object().keys({
    videoGroupId: Joi.custom(objectId),
    progressStatus: Joi.object(),
    recordings: Joi.object().required(),
  }),
};

const getWatchLogs = {
  query: Joi.object().keys({
    userId: Joi.custom(objectId),
    videoGroupId: Joi.custom(objectId),
    progressStatus: Joi.object(),
    recordFileName: Joi.string(),
    recordFilePath: Joi.string(),
    sortBy: Joi.string(),
    limit: Joi.number(),
  }),
};

const getWatchLog = {
  params: Joi.object().keys({
    watchLogId: Joi.string().custom(objectId),
  }),
};

const updateWatchLog = {
  params: Joi.object().keys({
    watchLogId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      videoGroupId: Joi.custom(objectId),
      progressStatus: Joi.object(),
      recordFileName: Joi.string(),
      recordFilePath: Joi.string(),
    })
    .min(1),
};

const deleteWatchLog = {
  params: Joi.object().keys({
    watchLogId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  createWatchLog,
  getWatchLogs,
  getWatchLog,
  updateWatchLog,
  deleteWatchLog,
};
