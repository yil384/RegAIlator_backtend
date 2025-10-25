const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { watchLogService } = require('../services');
const { writeToFile } = require('../utils/writeToFile');

const createWatchLog = catchAsync(async (req, res) => {
  const response = await writeToFile(req.body.recordings, req.user.username);

  const reqBody = {
    ...req.body,
    userId: req.user._id,
    progressStatus: req.body.recordings,
    recordFileName: response.filename,
    recordFilePath: response.fileHostPath,
  };

  const watchLog = await watchLogService.createWatchLog(reqBody);
  res.status(httpStatus.CREATED).send(watchLog);
});

const getWatchLogs = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['userId', 'videoGroupId', 'progressStatus', 'recordFileName', 'recordFilePath']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await watchLogService.queryWatchLogs(filter, options);
  res.send(result);
});

const getWatchLog = catchAsync(async (req, res) => {
  const user = await watchLogService.getWatchLogById(req.params.watchLogId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'WatchLog not found');
  }
  res.send(user);
});

const updateWatchLog = catchAsync(async (req, res) => {
  const user = await watchLogService.updateWatchLogById(req.params.watchLogId, req.body);
  res.send(user);
});

const deleteWatchLog = catchAsync(async (req, res) => {
  await watchLogService.deleteWatchLogById(req.params.watchLogId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  createWatchLog,
  getWatchLogs,
  getWatchLog,
  updateWatchLog,
  deleteWatchLog,
};
