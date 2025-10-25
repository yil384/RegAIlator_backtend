const httpStatus = require('http-status');
const { ErrorLog } = require('../models');
const ApiError = require('../utils/ApiError');

/**
 * Create a errorLog
 * @param {Object} errorLogBody
 * @returns {Promise<ErrorLog>}
 */
const createErrorLog = async (errorLogBody) => {
  return ErrorLog.create(errorLogBody);
};

/**
 * Query for errorLogs
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryErrorLogs = async (filter, options) => {
  return ErrorLog.paginate(filter, options);
};

/**
 * Get errorLog by id
 * @param {ObjectId} id
 * @returns {Promise<ErrorLog>}
 */
const getErrorLogById = async (id) => {
  return ErrorLog.findById(id);
};

/**
 * Update errorLog by id
 * @param {ObjectId} errorLogId
 * @param {Object} updateBody
 * @returns {Promise<ErrorLog>}
 */
const updateErrorLogById = async (errorLogId, updateBody) => {
  const errorLog = await getErrorLogById(errorLogId);
  if (!errorLog) {
    throw new ApiError(httpStatus.NOT_FOUND, 'ErrorLog not found');
  }
  Object.assign(errorLog, updateBody);
  await errorLog.save();
  return errorLog;
};

/**
 * Delete errorLog by id
 * @param {ObjectId} errorLogId
 * @returns {Promise<ErrorLog>}
 */
const deleteErrorLogById = async (errorLogId) => {
  const errorLog = await getErrorLogById(errorLogId);
  if (!errorLog) {
    throw new ApiError(httpStatus.NOT_FOUND, 'ErrorLog not found');
  }
  await errorLog.remove();
  return errorLog;
};

module.exports = {
  createErrorLog,
  queryErrorLogs,
  getErrorLogById,
  updateErrorLogById,
  deleteErrorLogById,
};
