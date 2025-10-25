const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const { toJSON, paginate } = require('./plugins');
const { roles } = require('../configs/roles');

const { ObjectId } = mongoose.SchemaTypes;

// Define attachment sub-schema
const attachmentSchema = mongoose.Schema(
  {
    filename: { type: String, required: false }, // 附件的文件名（可以不存在）
    contentType: { type: String, required: true }, // 附件的类型
    size: { type: Number, required: true }, // 附件的大小
    content: { type: String, required: true }, // 附件的内容
  },
  {
    _id: true,
    timestamps: true, // 自动生成createdAt和updatedAt字段
  }
);

// Define emailReply sub-schema
const emailReplySchema = mongoose.Schema(
  {
    subject: { type: String, required: true }, // 邮件主题
    content: { type: String, required: true }, // 邮件内容
    from: { type: String, required: true }, // 发件人邮箱
    to: { type: String, required: true }, // 收件人邮箱
    date: { type: Date, required: true }, // 邮件发送日期
    attachments: { type: [attachmentSchema], default: [] }, // 邮件的附件（可以是多个）
    surveyId: { type: ObjectId, ref: 'Survey', default: null }, // 邮件关联的调查
    tags: { type: [String], default: [] }, // 邮件的标签
    reply: { 
      type: {
        subject: { type: String, required: true }, // 回复的主题
        content: { type: String, required: true }, // 回复的内容
      }, 
      default: null, 
      required: false 
    }, // 准备回复的内容（AI生成，可以为空）
  },
  {
    _id: true,
    timestamps: true, // 自动生成createdAt和updatedAt字段
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
    chooseSurvey: { type: ObjectId, ref: 'Survey', default: null }, // Choose Survey (list of ObjectIds)
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
    title: { type: String, required: true }, // 调查的标题
    // name: { type: String, required: true }, // 调查的名字
    // content: { type: String, required: true }, // 调查的内容
    // description: { type: String }, // 调查的描述
    attachments: { type: [attachmentSchema], default: [] }, // 调查的附件
    revision: { type: Number, default: 0 }, // 调查的版本号
    html: { type: String }, // 调查的HTML
    json: { type: String }, // 调查的JSON
    createdAt: { type: Date, default: Date.now }, // 调查的创建时间
    updatedAt: { type: Date }, // 调查的更新时间
  },
  {
    _id: true,
    timestamps: true, // 自动生成createdAt和updatedAt字段
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
