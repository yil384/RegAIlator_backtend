const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { auditLogService } = require('../services');
const { writeToFile } = require('../utils/writeToFile');
const logger = require('../configs/logger');

const createAuditLog = catchAsync(async (req, res) => {
  const response = await writeToFile(req.body.recordings, req.user.username);

  const reqBody = {
    ...req.body,
    userId: req.user._id,
    progressStatus: req.body.recordings,
    recordFileName: response.filename,
    recordFilePath: response.fileHostPath,
  };

  const auditLog = await auditLogService.createAuditLog(reqBody);
  res.status(httpStatus.CREATED).send(auditLog);
});

const getAuditLogs = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['userId', 'videoGroupId', 'progressStatus', 'recordFileName', 'recordFilePath']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await auditLogService.queryAuditLogs(filter, options);
  res.send(result);
});

const getAuditLog = catchAsync(async (req, res) => {
  const auditLog = await auditLogService.getAuditLogById(req.params.auditLogId);
  if (!auditLog) {
    throw new ApiError(httpStatus.NOT_FOUND, 'AuditLog not found');
  }
  res.send(auditLog);
});

const updateAuditLog = catchAsync(async (req, res) => {
  const auditLog = await auditLogService.updateAuditLogById(req.params.auditLogId, req.body);
  res.send(auditLog);
});

const deleteAuditLog = catchAsync(async (req, res) => {
  await auditLogService.deleteAuditLogById(req.params.auditLogId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  createAuditLog,
  getAuditLogs,
  getAuditLog,
  updateAuditLog,
  deleteAuditLog,
};
