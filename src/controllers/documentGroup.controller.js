const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { documentGroupService } = require('../services');
const logger = require('../configs/logger');

const createDocumentGroup = catchAsync(async (req, res) => {
  const reqBody = {
    ...req.body,
    addedBy: req.user._id,
  };
  const documentGroup = await documentGroupService.createDocumentGroup(reqBody);
  res.status(httpStatus.CREATED).send(documentGroup);
});

const getDocumentGroups = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['groupName', 'addedBy', 'accessState']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await documentGroupService.queryDocumentGroups(filter, options);
  res.send(result);
});

const getDocumentGroup = catchAsync(async (req, res) => {
  const documentGroup = await documentGroupService.getDocumentGroupById(req.params.groupId);
  if (!documentGroup) {
    throw new ApiError(httpStatus.NOT_FOUND, 'DocumentGroup not found');
  }
  res.send(documentGroup);
});

const updateDocumentGroup = catchAsync(async (req, res) => {
  const documentGroup = await documentGroupService.updateDocumentGroupById(req.params.groupId, req.body);
  res.send(documentGroup);
});

const deleteDocumentGroup = catchAsync(async (req, res) => {
  await documentGroupService.deleteDocumentGroupById(req.params.groupId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  createDocumentGroup,
  getDocumentGroups,
  getDocumentGroup,
  updateDocumentGroup,
  deleteDocumentGroup,
};
