const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');
const constants = require('../configs/constants');

const { ObjectId } = mongoose.SchemaTypes;

const documentGroupSchema = mongoose.Schema(
  {
    groupName: { type: String, required: true, trim: true },
    addedBy: { type: ObjectId, ref: 'User', required: true },
    accessState: { type: String, enum: constants.accessState, default: 'private' },
  },
  {
    _id: true,
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
documentGroupSchema.plugin(toJSON);
documentGroupSchema.plugin(paginate);

/**
 * Check if groupName is taken
 * @param {string} groupName
 * @param {ObjectId} [excludeDocumentGroupId] - The id of the documentGroup to be excluded
 * @returns {Promise<boolean>}
 */
documentGroupSchema.statics.isGroupNameTaken = async function (groupName, excludeDocumentGroupId) {
  const documentGroup = await this.findOne({ groupName, _id: { $ne: excludeDocumentGroupId } });
  return !!documentGroup;
};

/**
 * @typedef DocumentGroup
 */
const DocumentGroup = mongoose.model('DocumentGroup', documentGroupSchema, 'videogroups');

module.exports = DocumentGroup;
