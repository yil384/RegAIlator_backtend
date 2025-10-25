const httpStatus = require('http-status');
const { VideoGroup } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Create a videoGroup
 * @param {Object} videoGroupBody
 * @returns {Promise<VideoGroup>}
 */
const createVideoGroup = async (videoGroupBody) => {
  if (videoGroupBody.groupName && (await VideoGroup.isGroupNameTaken(videoGroupBody.groupName))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'VideoGroupName already taken');
  }
  return VideoGroup.create(videoGroupBody);
};

/**
 * Query for videoGroups
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryVideoGroups = async (filter, options) => {
  return VideoGroup.paginate(filter, options);
};

/**
 * Get videoGroup by id
 * @param {ObjectId} id
 * @returns {Promise<VideoGroup>}
 */
const getVideoGroupById = async (id) => {
  return VideoGroup.findById(id);
};

/**
 * Update videoGroup by id
 * @param {ObjectId} videoGroupId
 * @param {Object} updateBody
 * @returns {Promise<VideoGroup>}
 */
const updateVideoGroupById = async (videoGroupId, updateBody) => {
  const videoGroup = await getVideoGroupById(videoGroupId);
  if (!videoGroup) {
    throw new ApiError(httpStatus.NOT_FOUND, 'VideoGroup not found');
  }
  if (updateBody.groupName && (await VideoGroup.isGroupNameTaken(updateBody.groupName, videoGroupId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'VideoGroupName already taken');
  }
  Object.assign(videoGroup, updateBody);
  await videoGroup.save();
  return videoGroup;
};

/**
 * Delete videoGroup by id
 * @param {ObjectId} videoGroupId
 * @returns {Promise<VideoGroup>}
 */
const deleteVideoGroupById = async (videoGroupId) => {
  const videoGroup = await getVideoGroupById(videoGroupId);
  if (!videoGroup) {
    throw new ApiError(httpStatus.NOT_FOUND, 'VideoGroup not found');
  }
  await videoGroup.remove();
  return videoGroup;
};

module.exports = {
  createVideoGroup,
  queryVideoGroups,
  getVideoGroupById,
  updateVideoGroupById,
  deleteVideoGroupById,
};
