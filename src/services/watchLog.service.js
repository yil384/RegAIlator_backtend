const httpStatus = require('http-status');
const { WatchLog } = require('../models');
const ApiError = require('../utils/ApiError');
const { removeFile } = require('../utils/removeFile');
/**
 * Create a watchLog
 * @param {Object} watchLogBody
 * @returns {Promise<WatchLog>}
 */
const createWatchLog = async (watchLogBody) => {
  return WatchLog.create(watchLogBody);
};

/**
 * Query for watchLogs
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryWatchLogs = async (filter, options) => {
  // return WatchLog.paginate(filter, options);
  return WatchLog.paginate(filter, { ...options, populate: 'userId,videoGroupId' });
};

/**
 * Get watchLog by id
 * @param {ObjectId} id
 * @returns {Promise<WatchLog>}
 */
const getWatchLogById = async (id) => {
  return WatchLog.findById(id);
};

/**
 * Update watchLog by id
 * @param {ObjectId} watchLogId
 * @param {Object} updateBody
 * @returns {Promise<WatchLog>}
 */
const updateWatchLogById = async (watchLogId, updateBody) => {
  const watchLog = await getWatchLogById(watchLogId);
  if (!watchLog) {
    throw new ApiError(httpStatus.NOT_FOUND, 'WatchLog not found');
  }
  Object.assign(watchLog, updateBody);
  await watchLog.save();
  return watchLog;
};

/**
 * Delete watchLog by id
 * @param {ObjectId} watchLogId
 * @returns {Promise<WatchLog>}
 */
const deleteWatchLogById = async (watchLogId) => {
  const watchLog = await getWatchLogById(watchLogId);
  await removeFile(watchLog.recordFileName);

  if (!watchLog) {
    throw new ApiError(httpStatus.NOT_FOUND, 'WatchLog not found');
  }
  await watchLog.remove();

  return watchLog;
};

module.exports = {
  createWatchLog,
  queryWatchLogs,
  getWatchLogById,
  updateWatchLogById,
  deleteWatchLogById,
};
