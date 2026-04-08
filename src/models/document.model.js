const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');
const constants = require('../configs/constants');

const { ObjectId } = mongoose.SchemaTypes;

const documentSchema = mongoose.Schema(
  {
    title: { type: String, required: true },
    path: { type: String, required: true },
    accessState: { type: String, enum: constants.accessState, default: 'private' },
    addedBy: { type: ObjectId, ref: 'User', required: true },
    // JSON-formatted data
    json: { type: Object, default: {} },
    // References a supplier subdocument _id within a User document (not a separate collection)
    supplier: { type: ObjectId, default: null },
  },
  {
    _id: true,
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
documentSchema.plugin(toJSON);
documentSchema.plugin(paginate);

/**
 * Check if file path is taken
 * @param title
 * @param {ObjectId} [excludeDocumentId] - The id of the user to be excluded
 * @returns {Promise<boolean>}
 */
documentSchema.statics.isPathTaken = async function (path, excludeDocumentId) {
  const document = await this.findOne({ path, _id: { $ne: excludeDocumentId } });
  return !!document;
};

/**
 * @typedef Document
 */
const Document = mongoose.model('Document', documentSchema, 'videos');

module.exports = Document;
