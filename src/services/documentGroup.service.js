const httpStatus = require('http-status');
const { DocumentGroup } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../configs/logger');

/**
 * Create a documentGroup
 * @param {Object} documentGroupBody
 * @returns {Promise<DocumentGroup>}
 */
const createDocumentGroup = async (documentGroupBody) => {
  if (documentGroupBody.groupName && (await DocumentGroup.isGroupNameTaken(documentGroupBody.groupName))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'DocumentGroupName already taken');
  }
  return DocumentGroup.create(documentGroupBody);
};

/**
 * Query for documentGroups
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryDocumentGroups = async (filter, options) => {
  return DocumentGroup.paginate(filter, options);
};

/**
 * Get documentGroup by id
 * @param {ObjectId} id
 * @returns {Promise<DocumentGroup>}
 */
const getDocumentGroupById = async (id) => {
  return DocumentGroup.findById(id);
};

/**
 * Update documentGroup by id
 * @param {ObjectId} documentGroupId
 * @param {Object} updateBody
 * @returns {Promise<DocumentGroup>}
 */
const updateDocumentGroupById = async (documentGroupId, updateBody) => {
  const documentGroup = await getDocumentGroupById(documentGroupId);
  if (!documentGroup) {
    throw new ApiError(httpStatus.NOT_FOUND, 'DocumentGroup not found');
  }
  if (updateBody.groupName && (await DocumentGroup.isGroupNameTaken(updateBody.groupName, documentGroupId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'DocumentGroupName already taken');
  }
  Object.assign(documentGroup, updateBody);
  await documentGroup.save();
  return documentGroup;
};

/**
 * Delete documentGroup by id
 * @param {ObjectId} documentGroupId
 * @returns {Promise<DocumentGroup>}
 */
const deleteDocumentGroupById = async (documentGroupId) => {
  const documentGroup = await getDocumentGroupById(documentGroupId);
  if (!documentGroup) {
    throw new ApiError(httpStatus.NOT_FOUND, 'DocumentGroup not found');
  }
  await DocumentGroup.deleteOne({ _id: documentGroup._id });
  return documentGroup;
};

module.exports = {
  createDocumentGroup,
  queryDocumentGroups,
  getDocumentGroupById,
  updateDocumentGroupById,
  deleteDocumentGroupById,
};
