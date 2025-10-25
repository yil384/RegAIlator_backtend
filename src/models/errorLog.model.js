const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const { ObjectId } = mongoose.SchemaTypes;

const ErrorLogSchema = mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User' },
    stackTrace: mongoose.Schema.Types.Mixed,
    errorMessage: { type: String },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
ErrorLogSchema.plugin(toJSON);
ErrorLogSchema.plugin(paginate);

/**
 * @typedef ErrorLog
 */
const ErrorLog = mongoose.model('ErrorLogs', ErrorLogSchema);

module.exports = ErrorLog;
