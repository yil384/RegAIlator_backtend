const Joi = require('joi');
const { objectId } = require('./custom.validation');
const constants = require('../configs/constants');

const createDocumentGroup = {
  body: Joi.object().keys({
    groupName: Joi.string().required(),
    addedBy: Joi.custom(objectId),
    accessState: Joi.string().valid(...constants.accessState),
  }),
};

const getDocumentGroups = {
  query: Joi.object().keys({
    groupName: Joi.string(),
    addedBy: Joi.string(),
    accessState: Joi.string(),
  }),
};

const getDocumentGroup = {
  params: Joi.object().keys({
    groupId: Joi.string().custom(objectId),
  }),
};

const updateDocumentGroup = {
  params: Joi.object().keys({
    groupId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      groupName: Joi.string(),
      accessState: Joi.string().valid(...constants.accessState),
    })
    .min(1),
};

const deleteDocumentGroup = {
  params: Joi.object().keys({
    groupId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  createDocumentGroup,
  getDocumentGroups,
  getDocumentGroup,
  updateDocumentGroup,
  deleteDocumentGroup,
};
