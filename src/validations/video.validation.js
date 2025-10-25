const Joi = require('joi');
const { objectId } = require('./custom.validation');
const constants = require('../configs/constants');

const createVideo = {
  body: Joi.object().keys({
    title: Joi.string().required(),
    path: Joi.string().required(),
    group: Joi.custom(objectId),
    accessState: Joi.string().valid(...constants.accessState),
    addedBy: Joi.custom(objectId),
  }),
};

const getVideos = {
  query: Joi.object().keys({
    limit: Joi.number(),
    title: Joi.string(),
    sortBy: Joi.string(),
    page: Joi.string(),
    path: Joi.string(),
    group: Joi.custom(objectId),
    accessState: Joi.string().valid(...constants.accessState),
    addedBy: Joi.custom(objectId),
  }),
};

const getVideo = {
  params: Joi.object().keys({
    videoId: Joi.string().custom(objectId),
  }),
};

const updateVideo = {
  params: Joi.object().keys({
    videoId: Joi.required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      title: Joi.string(),
      path: Joi.string(),
      group: Joi.custom(objectId),
      accessState: Joi.string().valid(...constants.accessState),
      addedBy: Joi.custom(objectId),
    })
    .min(1),
};

const deleteVideo = {
  params: Joi.object().keys({
    videoId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  createVideo,
  getVideos,
  getVideo,
  updateVideo,
  deleteVideo,
};
