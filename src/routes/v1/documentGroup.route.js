const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const documentGroupValidation = require('../../validations/documentGroup.validation');
const documentGroupController = require('../../controllers/documentGroup.controller');
const roles = require('../../configs/roles');

const router = express.Router();

router
  .route('/')
  .post(
    auth(roles.accessCategories.documentGroup.manageDocumentGroups),
    validate(documentGroupValidation.createDocumentGroup),
    documentGroupController.createDocumentGroup
  )
  .get(
    auth(roles.accessCategories.documentGroup.getDocumentGroups),
    validate(documentGroupValidation.getDocumentGroups),
    documentGroupController.getDocumentGroups
  );

router
  .route('/:groupId')
  .get(
    auth(roles.accessCategories.documentGroup.getDocumentGroups),
    validate(documentGroupValidation.getDocumentGroup),
    documentGroupController.getDocumentGroup
  )
  .patch(
    auth(roles.accessCategories.documentGroup.manageDocumentGroups),
    validate(documentGroupValidation.updateDocumentGroup),
    documentGroupController.updateDocumentGroup
  )
  .delete(
    auth(roles.accessCategories.documentGroup.manageDocumentGroups),
    validate(documentGroupValidation.deleteDocumentGroup),
    documentGroupController.deleteDocumentGroup
  );

module.exports = router;
