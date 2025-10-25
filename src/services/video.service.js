const httpStatus = require('http-status');
const { Video } = require('../models');
const ApiError = require('../utils/ApiError');
const { renameVideoFile } = require('../utils/renameFile');
// eslint-disable-next-line camelcase
const { api_host } = require('../configs/config');
const { removeVideoFile } = require('../utils/removeVideoFile');

/**
 * Create a video
 * @param {Object} videoBody
 * @returns {Promise<Video>}
 */
const createVideo = async (videoBody) => {
  // if (videoBody.path && (await Video.isPathTaken(videoBody.path))) {
  //   return new ApiError(httpStatus.BAD_REQUEST, 'File path already taken');
  // }
  if (videoBody.group === '') {
    delete videoBody.group;
  }
  return Video.create(videoBody);
};

/**
 * Create a video
 * @param {Object} videoBody
 * @returns {Promise<Video>}
 */
const createVideoFromUpload = async (videoBody) => {
  if (videoBody.title && (await Video.isTitleTaken(videoBody.title))) {
    return new ApiError(httpStatus.BAD_REQUEST, 'Video title already taken');
  }
  return Video.create(videoBody);
};

/**
 * Query for videos
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryVideos = async (filter, options) => {
  return Video.paginate(filter, { ...options, populate: 'group' });
};

/**
 * Get video by id
 * @param {ObjectId} id
 * @returns {Promise<Video>}
 */
const getVideoById = async (id) => {
  return Video.findById(id);
};

/**
 * Update video by id
 * @param {ObjectId} videoId
 * @param {Object} updateBody
 * @returns {Promise<Video>}
 */
const updateVideoById = async (videoId, updateBody) => {
  const updateVideoBody = { ...updateBody };
  const video = await getVideoById(videoId);
  if (!video) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Video not found');
  }
  if (updateBody.name && (await Video.isNameTaken(updateBody.name, videoId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'VideoName already taken');
  }
  if (updateBody.path) {
    // console.log('updateBody.path>>>', updateBody.path);
    const splitPath = updateBody.path.split('/');
    const splitFileName = splitPath[splitPath.length - 1].split('.');
    const isConvertedPath = splitPath[splitPath.length - 2] === 'converted';
    const fileExtension = splitFileName[splitFileName.length - 1];
    const fileName = splitFileName[splitFileName.length - 2];
    // console.log({ isConvertedPath, fileExtension, fileName });
    if (fileName !== updateBody.title) {
      let filePath = `/uploads`;
      if (isConvertedPath) {
        filePath = `/uploads/converted`;
      }
      const oldPath = `.${filePath}/${fileName}.${fileExtension}`;
      const newPath = `.${filePath}/${updateBody.title}.${fileExtension}`;
      // eslint-disable-next-line camelcase
      updateVideoBody.path = `${api_host}${filePath}/${updateBody.title}.${fileExtension}`;
      await renameVideoFile(oldPath, newPath);
    }
  }
  Object.assign(video, updateVideoBody);
  await video.save();
  return video;
};

/**
 * Delete video by id
 * @param {ObjectId} videoId
 * @returns {Promise<Video>}
 */
const deleteVideoById = async (videoId) => {
  const video = await getVideoById(videoId);
  if (!video) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Video not found');
  }
  const splitPath = video.path.split('/');
  const isConvertedPath = splitPath[splitPath.length - 2] === 'converted';
  const fileName = splitPath[splitPath.length - 1];
  // console.log({ isConvertedPath, fileName });
  let filePath = `./uploads/${fileName}`;
  if (isConvertedPath) {
    filePath = `./uploads/converted/${fileName}`;
  }
  await removeVideoFile(filePath);
  await video.remove();
  return video;
};

module.exports = {
  createVideo,
  createVideoFromUpload,
  queryVideos,
  getVideoById,
  updateVideoById,
  deleteVideoById,
};
