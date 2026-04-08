const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');
const constants = require('../configs/constants');

const { ObjectId } = mongoose.SchemaTypes;

const videoGroupSchema = mongoose.Schema(
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
videoGroupSchema.plugin(toJSON);
videoGroupSchema.plugin(paginate);

/**
 * Check if groupName is taken
 * @param {string} groupName
 * @param {ObjectId} [excludeVideoGroupId] - The id of the videoGroup to be excluded
 * @returns {Promise<boolean>}
 */
videoGroupSchema.statics.isGroupNameTaken = async function (groupName, excludeVideoGroupId) {
  const videoGroup = await this.findOne({ groupName, _id: { $ne: excludeVideoGroupId } });
  return !!videoGroup;
};

/**
 * @typedef VideoGroup
 */
const VideoGroup = mongoose.model('VideoGroup', videoGroupSchema);

module.exports = VideoGroup;
