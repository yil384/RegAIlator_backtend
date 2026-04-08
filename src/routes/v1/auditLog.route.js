const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const auditLog = require('../../validations/auditLog.validation');
const auditLogController = require('../../controllers/auditLog.controller');
const roles = require('../../configs/roles');

const router = express.Router();

router
  .route('/')
  .post(
    auth(roles.accessCategories.auditLog.manageAuditLog),
    validate(auditLog.createAuditLog),
    auditLogController.createAuditLog
  )
  .get(auth(roles.accessCategories.auditLog.getAuditLog), validate(auditLog.getAuditLogs), auditLogController.getAuditLogs);

router
  .route('/:auditLogId')
  .get(auth(roles.accessCategories.auditLog.getAuditLog), validate(auditLog.getAuditLog), auditLogController.getAuditLog)
  .patch(
    auth(roles.accessCategories.auditLog.manageAuditLog),
    validate(auditLog.updateAuditLog),
    auditLogController.updateAuditLog
  )
  .delete(
    auth(roles.accessCategories.auditLog.manageAuditLog),
    validate(auditLog.deleteAuditLog),
    auditLogController.deleteAuditLog
  );

module.exports = router;
