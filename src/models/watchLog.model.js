const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const { ObjectId } = mongoose.SchemaTypes;

const WatchLogSchema = mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    videoGroupId: { type: ObjectId, ref: 'VideoGroup', required: true },
    progressStatus: { type: Object, required: true },
    recordFileName: { type: String, required: true },
    recordFilePath: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
WatchLogSchema.plugin(toJSON);
WatchLogSchema.plugin(paginate);

/**
 * @typedef WatchLog
 */
const WatchLog = mongoose.model('WatchLog', WatchLogSchema);

module.exports = WatchLog;
