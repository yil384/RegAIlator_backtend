const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { errorLogService } = require('../services');

const createErrorLog = catchAsync(async (req, res) => {
  const reqBody = {
    ...req.body,
  };
  const errorLog = await errorLogService.createErrorLog(reqBody);
  res.status(httpStatus.CREATED).send(errorLog);
});

const getErrorLogs = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['userId', 'stackTrace', 'errorMessage']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await errorLogService.queryErrorLogs(filter, options);
  res.send(result);
});

const getErrorLog = catchAsync(async (req, res) => {
  const user = await errorLogService.getErrorLogById(req.params.errorLogId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'ErrorLog not found');
  }
  res.send(user);
});

const updateErrorLog = catchAsync(async (req, res) => {
  const user = await errorLogService.updateErrorLogById(req.params.errorLogId, req.body);
  res.send(user);
});

const deleteErrorLog = catchAsync(async (req, res) => {
  await errorLogService.deleteErrorLogById(req.params.errorLogId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  createErrorLog,
  getErrorLogs,
  getErrorLog,
  updateErrorLog,
  deleteErrorLog,
};
