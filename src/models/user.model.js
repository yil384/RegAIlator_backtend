const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const { toJSON, paginate } = require('./plugins');
const { roles } = require('../configs/roles');

const { ObjectId } = mongoose.SchemaTypes;

// Define attachment sub-schema
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

// Define emailReply sub-schema
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

// Define a sub-schema for suppliers
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

/**
 * @typedef User
 */
const User = mongoose.model('User', userSchema);

module.exports = User;
