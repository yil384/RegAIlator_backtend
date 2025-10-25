const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const errorLog = require('../../validations/errorLog.validation');
const errorLogController = require('../../controllers/errorLog.controller');
const roles = require('../../configs/roles');

const router = express.Router();

router
  .route('/')
  .post(
    auth(roles.accessCategories.errorLog.manageErrorLog),
    validate(errorLog.createErrorLog),
    errorLogController.createErrorLog
  )
  .get(auth(roles.accessCategories.errorLog.getErrorLog), validate(errorLog.getErrorLogs), errorLogController.getErrorLogs);

router
  .route('/:errorLogId')
  .get(auth(roles.accessCategories.errorLog.getErrorLog), validate(errorLog.getErrorLog), errorLogController.getErrorLog)
  .patch(
    auth(roles.accessCategories.errorLog.manageErrorLog),
    validate(errorLog.updateErrorLog),
    errorLogController.updateErrorLog
  )
  .delete(
    auth(roles.accessCategories.errorLog.manageErrorLog),
    validate(errorLog.deleteErrorLog),
    errorLogController.deleteErrorLog
  );

module.exports = router;
