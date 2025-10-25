const Joi = require('joi');
const { objectId } = require('./custom.validation');
const constants = require('../configs/constants');

const createVideoGroup = {
  body: Joi.object().keys({
    groupName: Joi.string().required(),
    addedBy: Joi.custom(objectId),
    accessState: Joi.string().valid(...constants.accessState),
  }),
};

const getVideoGroups = {
  query: Joi.object().keys({
    groupName: Joi.string(),
    addedBy: Joi.string(),
    accessState: Joi.string(),
  }),
};

const getVideoGroup = {
  params: Joi.object().keys({
    groupId: Joi.string().custom(objectId),
  }),
};

const updateVideoGroup = {
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

const deleteVideoGroup = {
  params: Joi.object().keys({
    groupId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  createVideoGroup,
  getVideoGroups,
  getVideoGroup,
  updateVideoGroup,
  deleteVideoGroup,
};
