const httpStatus = require('http-status');
const { Document } = require('../models');
const ApiError = require('../utils/ApiError');
const { renameFile } = require('../utils/renameFile');
// eslint-disable-next-line camelcase
const { api_host } = require('../configs/config');
const { removeFile } = require('../utils/removeVideoFile');
const logger = require('../configs/logger');

/**
 * Create a document
 * @param {Object} documentBody
 * @returns {Promise<Document>}
 */
const createDocument = async (documentBody) => {
  if (documentBody.group === '') {
    delete documentBody.group;
  }
  return Document.create(documentBody);
};

/**
 * Create a document from upload
 * @param {Object} documentBody
 * @returns {Promise<Document>}
 */
const createDocumentFromUpload = async (documentBody) => {
  if (documentBody.path && (await Document.isPathTaken(documentBody.path))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Document file path already taken');
  }
  return Document.create(documentBody);
};

/**
 * Query for documents
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryDocuments = async (filter, options) => {
  return Document.paginate(filter, { ...options, populate: 'group' });
};

/**
 * Get document by id
 * @param {ObjectId} id
 * @returns {Promise<Document>}
 */
const getDocumentById = async (id) => {
  return Document.findById(id);
};

/**
 * Update document by id
 * @param {ObjectId} documentId
 * @param {Object} updateBody
 * @returns {Promise<Document>}
 */
const updateDocumentById = async (documentId, updateBody) => {
  const updateDocumentBody = { ...updateBody };
  const document = await getDocumentById(documentId);
  if (!document) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
  }
  if (updateBody.path && (await Document.isPathTaken(updateBody.path, documentId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Document file path already taken');
  }
  if (updateBody.path) {
    const splitPath = updateBody.path.split('/');
    const splitFileName = splitPath[splitPath.length - 1].split('.');
    const isConvertedPath = splitPath[splitPath.length - 2] === 'converted';
    const fileExtension = splitFileName[splitFileName.length - 1];
    const fileName = splitFileName[splitFileName.length - 2];
    if (fileName !== updateBody.title) {
      let filePath = `/uploads`;
      if (isConvertedPath) {
        filePath = `/uploads/converted`;
      }
      const oldPath = `.${filePath}/${fileName}.${fileExtension}`;
      const newPath = `.${filePath}/${updateBody.title}.${fileExtension}`;
      // eslint-disable-next-line camelcase
      updateDocumentBody.path = `${api_host}${filePath}/${updateBody.title}.${fileExtension}`;
      await renameFile(oldPath, newPath);
    }
  }
  Object.assign(document, updateDocumentBody);
  await document.save();
  return document;
};

/**
 * Delete document by id
 * @param {ObjectId} documentId
 * @returns {Promise<Document>}
 */
const deleteDocumentById = async (documentId) => {
  const document = await getDocumentById(documentId);
  if (!document) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
  }
  const splitPath = document.path.split('/');
  const isConvertedPath = splitPath[splitPath.length - 2] === 'converted';
  const fileName = splitPath[splitPath.length - 1];
  let filePath = `./uploads/${fileName}`;
  if (isConvertedPath) {
    filePath = `./uploads/converted/${fileName}`;
  }
  await removeFile(filePath);
  await Document.deleteOne({ _id: document._id });
  return document;
};

module.exports = {
  createDocument,
  createDocumentFromUpload,
  queryDocuments,
  getDocumentById,
  updateDocumentById,
  deleteDocumentById,
};
