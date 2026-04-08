const httpStatus = require('http-status');
const { AuditLog } = require('../models');
const ApiError = require('../utils/ApiError');
const { removeFile } = require('../utils/removeFile');
const logger = require('../configs/logger');

/**
 * Create an auditLog
 * @param {Object} auditLogBody
 * @returns {Promise<AuditLog>}
 */
const createAuditLog = async (auditLogBody) => {
  return AuditLog.create(auditLogBody);
};

/**
 * Query for auditLogs
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryAuditLogs = async (filter, options) => {
  return AuditLog.paginate(filter, { ...options, populate: 'userId,documentGroupId' });
};

/**
 * Get auditLog by id
 * @param {ObjectId} id
 * @returns {Promise<AuditLog>}
 */
const getAuditLogById = async (id) => {
  return AuditLog.findById(id);
};

/**
 * Update auditLog by id
 * @param {ObjectId} auditLogId
 * @param {Object} updateBody
 * @returns {Promise<AuditLog>}
 */
const updateAuditLogById = async (auditLogId, updateBody) => {
  const auditLog = await getAuditLogById(auditLogId);
  if (!auditLog) {
    throw new ApiError(httpStatus.NOT_FOUND, 'AuditLog not found');
  }
  Object.assign(auditLog, updateBody);
  await auditLog.save();
  return auditLog;
};

/**
 * Delete auditLog by id
 * @param {ObjectId} auditLogId
 * @returns {Promise<AuditLog>}
 */
const deleteAuditLogById = async (auditLogId) => {
  const auditLog = await getAuditLogById(auditLogId);
  if (!auditLog) {
    throw new ApiError(httpStatus.NOT_FOUND, 'AuditLog not found');
  }
  await removeFile(auditLog.recordFileName);
  await AuditLog.deleteOne({ _id: auditLog._id });

  return auditLog;
};

module.exports = {
  createAuditLog,
  queryAuditLogs,
  getAuditLogById,
  updateAuditLogById,
  deleteAuditLogById,
};
