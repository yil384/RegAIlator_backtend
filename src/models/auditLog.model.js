const mongoose = require('mongoose');
const { toJSON, paginate } = require('./plugins');

const { ObjectId } = mongoose.SchemaTypes;

const auditLogSchema = mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    videoGroupId: { type: ObjectId, ref: 'DocumentGroup', required: true },
    progressStatus: { type: Object, required: true },
    recordFileName: { type: String, required: true },
    recordFilePath: { type: String, required: true },
  },
  {
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
auditLogSchema.plugin(toJSON);
auditLogSchema.plugin(paginate);

/**
 * @typedef AuditLog
 */
const AuditLog = mongoose.model('AuditLog', auditLogSchema, 'watchlogs');

module.exports = AuditLog;
