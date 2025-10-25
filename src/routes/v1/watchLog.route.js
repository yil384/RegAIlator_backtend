const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const watchLog = require('../../validations/watchLog.validation');
const watchLogController = require('../../controllers/watchLog.controller');
const roles = require('../../configs/roles');

const router = express.Router();

router
  .route('/')
  .post(
    auth(roles.accessCategories.watchLog.manageWatchLog),
    validate(watchLog.createWatchLog),
    watchLogController.createWatchLog
  )
  .get(auth(roles.accessCategories.watchLog.getWatchLog), validate(watchLog.getWatchLogs), watchLogController.getWatchLogs);

router
  .route('/:watchLogId')
  .get(auth(roles.accessCategories.watchLog.getWatchLog), validate(watchLog.getWatchLog), watchLogController.getWatchLog)
  .patch(
    auth(roles.accessCategories.watchLog.manageWatchLog),
    validate(watchLog.updateWatchLog),
    watchLogController.updateWatchLog
  )
  .delete(
    auth(roles.accessCategories.watchLog.manageWatchLog),
    validate(watchLog.deleteWatchLog),
    watchLogController.deleteWatchLog
  );

module.exports = router;
