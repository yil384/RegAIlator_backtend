const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const document = require('../../validations/document.validation');
const documentController = require('../../controllers/document.controller');
const roles = require('../../configs/roles');

const router = express.Router();

router
  .route('/')
  .post(auth(roles.accessCategories.document.manageDocument), validate(document.createDocument), documentController.createDocument)
  .get(auth(roles.accessCategories.document.getDocument), validate(document.getDocuments), documentController.getDocuments);

router
  .route('/:documentId')
  .get(auth(roles.accessCategories.document.getDocument), validate(document.getDocument), documentController.getDocument)
  .patch(auth(roles.accessCategories.document.manageDocument), validate(document.updateDocument), documentController.updateDocument)
  .delete(auth(roles.accessCategories.document.manageDocument), validate(document.deleteDocument), documentController.deleteDocument);

router.route('/upload_file').post(auth(roles.accessCategories.document.manageDocument), documentController.uploadDocumentFiles);
router.route('/upload_file/:supplierId').post(auth(roles.accessCategories.document.manageDocument), documentController.uploadDocumentFiles);

router.route('/parse').post(auth(roles.accessCategories.document.manageDocument), documentController.parseDocuments);

module.exports = router;
