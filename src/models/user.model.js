/**
 * @module models/user
 * @description Mongoose schema definitions for the User document and its embedded subdocuments.
 *
 * ## Data Model Overview
 *
 * The User document is the central aggregate in this application. Rather than
 * splitting suppliers and surveys into separate collections (which would require
 * joins), they are embedded as subdocument arrays directly on the User. This
 * ensures that all of a user's data is fetched in a single query and that
 * updates to a user's suppliers or surveys are atomic within the User document.
 *
 * ### Document hierarchy:
 *
 *   User
 *   +-- suppliers[]  (supplierSchema)
 *   |   +-- rawMaterials[]  (rawMaterialSchema)
 *   |   +-- feedback[]      (emailReplySchema)  <-- incoming email replies from this supplier
 *   |       +-- attachments[]  (attachmentSchema)
 *   |       +-- tags[]         (AI-generated compliance tags)
 *   |       +-- reply          (AI-drafted reply suggestion)
 *   +-- surveys[]   (surveySchema)               <-- reusable email survey templates
 *       +-- attachments[]  (attachmentSchema)
 *
 * ### Key relationships:
 *
 * - `supplier.chooseSurvey` (ObjectId) references one of the parent user's
 *   `surveys[]` entries. This links a supplier to the survey template that
 *   will be sent to them.
 * - `feedback[].surveyId` (ObjectId) references the survey the feedback relates
 *   to, enabling per-survey filtering of a supplier's reply history.
 * - The `feedback` array on each supplier grows with each incoming email from
 *   that supplier (see emailListener.service.js).
 *
 * ### Why subdocuments instead of separate collections?
 *
 * 1. A user typically has tens to low hundreds of suppliers and a handful of
 *    surveys -- well within MongoDB's document size limit.
 * 2. Reads are fast: one query returns everything the UI needs.
 * 3. Writes are atomic at the document level -- no need for transactions.
 * 4. The tradeoff is that updating a single supplier requires loading the full
 *    User document, which is acceptable at this scale.
 */
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const { toJSON, paginate } = require('./plugins');
const { roles } = require('../configs/roles');

const { ObjectId } = mongoose.SchemaTypes;

/**
 * Attachment subdocument -- reused by both email replies and survey templates.
 * The `content` field stores a URL path (e.g., `/api/uploads/<uuid>.pdf` or
 * `/api/attachments/<uuid>.pdf`) rather than the raw binary, so files are
 * served via Express static middleware.
 */
const attachmentSchema = mongoose.Schema(
  {
    filename: { type: String, required: false }, // Attachment filename (optional)
    contentType: { type: String, required: true }, // Attachment MIME type
    size: { type: Number, required: true }, // Attachment size
    content: { type: String, required: true }, // Attachment content
  },
  {
    _id: true,
    timestamps: true, // Auto-generate createdAt and updatedAt fields
  }
);

/**
 * Email reply (feedback) subdocument -- represents a single incoming email
 * from a supplier. Stored in `supplier.feedback[]`. The `surveyId` links this
 * reply to the survey that was originally sent (null if no survey was assigned).
 * `tags` and `reply` are populated by the AI tagging script (gen_tags.py) and
 * can be manually overridden by the user via the UI.
 */
const emailReplySchema = mongoose.Schema(
  {
    subject: { type: String, required: true }, // Email subject
    content: { type: String, required: true }, // Email body
    from: { type: String, required: true }, // Sender email address
    to: { type: String, required: true }, // Recipient email address
    date: { type: Date, required: true }, // Email send date
    attachments: { type: [attachmentSchema], default: [] }, // Email attachments (can be multiple)
    surveyId: { type: ObjectId, default: null },
    tags: { type: [String], default: [] }, // Email tags
    reply: {
      type: {
        subject: { type: String, required: true }, // Reply subject
        content: { type: String, required: true }, // Reply content
      },
      default: null,
      required: false
    }, // Prepared reply content (AI-generated, can be null)
  },
  {
    _id: true,
    timestamps: true, // Auto-generate createdAt and updatedAt fields
  }
);

/** Raw material subdocument -- tracks materials supplied by a specific supplier. */
const rawMaterialSchema = mongoose.Schema(
  {
    rawMaterialName: { type: String }, // Raw Material Name
    rawMaterialPartNumber: { type: String }, // Raw Material Part Number
  },
  {
    _id: true,
    timestamps: true,
  }
);

/**
 * Supplier subdocument -- a company/contact that the user manages for
 * regulatory compliance. Key fields:
 * - `chooseSurvey`: links to a survey template (one of the user's surveys[])
 * - `feedback[]`: chronological list of incoming email replies
 * - `nextEmailSendTime` / `isEmailSent`: used by the scheduled email reminder
 *   system; reset when a new reply is received (see emailListener.service.js)
 */
const supplierSchema = mongoose.Schema(
  {
    supplierName: { type: String, required: true }, // Supplier name
    contact: { type: String, trim: true },          // Contact
    rawMaterials: { type: [rawMaterialSchema], default: [] }, // List of raw materials
    chooseSurvey: { type: ObjectId, default: null },
    status: { type: String },                       // Status
    feedback: { type: [emailReplySchema], default: [] }, // List of email replies (emailReply)
    supplierDocuments: { type: String },            // Supplier Documents
    nextEmailSendTime: { type: Date, default: null }, // The time for the next email reminder
    isEmailSent: { type: Boolean, default: false }, // Whether the email has been sent
  },
  {
    _id: true,
    timestamps: true,
  }
);

/**
 * Survey template subdocument -- a reusable email template that can be assigned
 * to suppliers. Contains HTML content (for the email body), optional attachments,
 * and a revision counter for version tracking. The JSON field can store the
 * structured editor state for rich-text editing in the frontend.
 */
const surveySchema = mongoose.Schema(
  {
    title: { type: String, required: true }, // Survey title
    // name: { type: String, required: true }, // Survey name
    // content: { type: String, required: true }, // Survey content
    // description: { type: String }, // Survey description
    attachments: { type: [attachmentSchema], default: [] }, // Survey attachments
    revision: { type: Number, default: 0 }, // Survey revision number
    html: { type: String }, // Survey HTML
    json: { type: String }, // Survey JSON
    createdAt: { type: Date, default: Date.now }, // Survey creation time
    updatedAt: { type: Date }, // Survey last updated time
  },
  {
    _id: true,
    timestamps: true, // Auto-generate createdAt and updatedAt fields
  }
);

/** Main User schema -- the root aggregate containing suppliers and surveys. */
const userSchema = mongoose.Schema(
  {
    firstname: { type: String, required: true, trim: true },
    lastname: { type: String, required: true, trim: true },
    username: { type: String, trim: true, default: function() { return `${this.firstname}_${this.lastname}`; }},
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error('Invalid email');
        }
      },
    },
    password: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      validate(value) {
        if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
          throw new Error('Password must contain at least one letter and one number');
        }
      },
      private: true, // used by the toJSON plugin
    },
    role: { type: String, enum: roles, default: 'guest' },
    isEmailVerified: { type: Boolean, default: false },
    lastActiveAt: { type: Date },
    status: { type: String, default: 'inactive' },
    suppliers: {
      type: [supplierSchema], // An array of supplier subdocuments
      default: [],
    },
    surveys: {
      type: [surveySchema], // An array of survey subdocuments
      default: [],
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

// add plugin that converts mongoose to json
userSchema.plugin(toJSON);
userSchema.plugin(paginate);

/**
 * Check if username is taken
 * @param username
 * @param {ObjectId} [excludeUserId] - The id of the user to be excluded
 * @returns {Promise<boolean>}
 */
userSchema.statics.isUserNameTaken = async function (username, excludeUserId) {
  const user = await this.findOne({ username, _id: { $ne: excludeUserId } });
  return !!user;
};

/**
 * Check if email is taken
 * @param {string} email - The user's email
 * @param {ObjectId} [excludeUserId] - The id of the user to be excluded
 * @returns {Promise<boolean>}
 */
userSchema.statics.isEmailTaken = async function (email, excludeUserId) {
  const user = await this.findOne({ email, _id: { $ne: excludeUserId } });
  return !!user;
};

/**
 * Check if password matches the user's password
 * @param {string} password
 * @returns {Promise<boolean>}
 */
userSchema.methods.isPasswordMatch = async function (password) {
  const user = this;
  return bcrypt.compare(password, user.password);
};

/**
 * Pre-save hook: hash the password with bcrypt (cost factor 8) whenever it is
 * new or modified. This ensures passwords are never stored in plain text.
 */
userSchema.pre('save', async function (next) {
  const user = this;
  if (user.isModified('password')) {
    user.password = await bcrypt.hash(user.password, 8);
  }
  next();
});

userSchema.pre('remove', async function (next) {
  this.model('User').remove({ userId: this._id }, next);
});

// Indexes for query performance
userSchema.index({ email: 1 });
userSchema.index({ 'suppliers.contact': 1 });
userSchema.index({ 'suppliers._id': 1 });

/**
 * @typedef User
 */
const User = mongoose.model('User', userSchema);

module.exports = User;
