const Joi = require('joi');
const { objectId } = require('./custom.validation');
const constants = require('../configs/constants');

const createDocument = {
  body: Joi.object().keys({
    title: Joi.string().required(),
    path: Joi.string().required(),
    group: Joi.custom(objectId),
    accessState: Joi.string().valid(...constants.accessState),
    addedBy: Joi.custom(objectId),
  }),
};

const getDocuments = {
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

const getDocument = {
  params: Joi.object().keys({
    documentId: Joi.string().custom(objectId),
  }),
};

const updateDocument = {
  params: Joi.object().keys({
    documentId: Joi.required().custom(objectId),
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

const deleteDocument = {
  params: Joi.object().keys({
    documentId: Joi.string().custom(objectId),
  }),
};

module.exports = {
  createDocument,
  getDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
};
