const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { videoGroupService } = require('../services');

const createVideoGroup = catchAsync(async (req, res) => {
  const reqBody = {
    ...req.body,
    addedBy: req.user._id,
  };
  const videoGroup = await videoGroupService.createVideoGroup(reqBody);
  res.status(httpStatus.CREATED).send(videoGroup);
});

const getVideoGroups = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['groupName', 'addedBy', 'accessState']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await videoGroupService.queryVideoGroups(filter, options);
  res.send(result);
});

const getVideoGroup = catchAsync(async (req, res) => {
  const user = await videoGroupService.getVideoGroupById(req.params.groupId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'VideoGroup not found');
  }
  res.send(user);
});

const updateVideoGroup = catchAsync(async (req, res) => {
  const user = await videoGroupService.updateVideoGroupById(req.params.groupId, req.body);
  res.send(user);
});

const deleteVideoGroup = catchAsync(async (req, res) => {
  await videoGroupService.deleteVideoGroupById(req.params.groupId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  createVideoGroup,
  getVideoGroups,
  getVideoGroup,
  updateVideoGroup,
  deleteVideoGroup,
};
