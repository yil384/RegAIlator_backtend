const Joi = require('joi');
const { objectId } = require('./custom.validation');

const createAuditLog = {
  body: Joi.object().keys({
    videoGroupId: Joi.custom(objectId),
    progressStatus: Joi.object(),
    recordings: Joi.object().required(),
  }),
};

const getAuditLogs = {
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

const getAuditLog = {
  params: Joi.object().keys({
    auditLogId: Joi.string().custom(objectId),
  }),
};

const updateAuditLog = {
  params: Joi.object().keys({
    auditLogId: Joi.required().custom(objectId),
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

const deleteAuditLog = {
  params: Joi.object().keys({
    auditLogId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  createAuditLog,
  getAuditLogs,
  getAuditLog,
  updateAuditLog,
  deleteAuditLog,
};
