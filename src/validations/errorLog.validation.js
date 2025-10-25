const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createErrorLog = {
  body: Joi.object().keys({
    userId: Joi.custom(objectId),
    stackTrace: Joi.any(),
    errorMessage: Joi.string(),
  }),
};

const getErrorLogs = {
  query: Joi.object().keys({
    userId: Joi.custom(objectId),
    stackTrace: Joi.any(),
    errorMessage: Joi.string(),
  }),
};

const getErrorLog = {
  params: Joi.object().keys({
    errorLogId: Joi.string().custom(objectId),
  }),
};

const updateErrorLog = {
  params: Joi.object().keys({
    errorLogId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      userId: Joi.custom(objectId),
      stackTrace: Joi.any(),
      errorMessage: Joi.string(),
    })
    .min(1),
};

const deleteErrorLog = {
  params: Joi.object().keys({
    errorLogId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  createErrorLog,
  getErrorLogs,
  getErrorLog,
  updateErrorLog,
  deleteErrorLog,
};
