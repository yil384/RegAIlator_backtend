const httpStatus = require('http-status');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const { subUserRoles } = require('../configs/roles');

/**
 * Create a user
 * @param {Object} userBody
 * @returns {Promise<User>}
 */

const createUser = async (userBody) => {
  if (await User.isEmailTaken(userBody.email)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  return User.create(userBody);
};

/**
 * Query for users
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryUsers = async (filter, options) => {
  return User.paginate(filter, options);
};

/**
 * Get user by id
 * @param {ObjectId} id
 * @returns {Promise<User>}
 */
const getUserById = async (id) => {
  return User.findById(id);
};

/**
 * Get suppliers by id
 * @param {ObjectId} id
 * @returns {Promise<User>}
 */
const getSuppliersbyId = async (id) => {
  return User.findById(id).populate('suppliers');
}

const createSupplier = async (id, supplierBody) => {
  // FIXME: 为了避免前端传入空字符串，将空字符串转换为 null
  if (supplierBody.chooseSurvey==='') {
    supplierBody.chooseSurvey = null;
  }
  supplierBody.feedback = [];

  const user = await User.findById(id);
  user.suppliers.push(supplierBody);
  await user.save();
  return user;
}

const createSupplierBatch = async (id, supplierBodies) => {
  const user = await User.findById(id);
  for (let supplierBody of supplierBodies) {
    // FIXME: 为了避免前端传入空字符串，将空字符串转换为 null
    if (supplierBody.chooseSurvey==='') {
      supplierBody.chooseSurvey = null;
    }
    supplierBody.feedback = [];
    user.suppliers.push(supplierBody);
  }
  await user.save();
  return user;
}

const updateSupplierById = async (userId, supplierId, supplierBody) => {
  // 验证传入的 userId 和 supplierId
  if (!userId || !supplierId) {
    throw new Error('User ID and Supplier ID are required');
  }
  // 查找用户
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  // 查找供应商
  const supplier = user.suppliers.id(supplierId);
  if (!supplier) {
    throw new Error('Supplier not found');
  }
  // 遍历 supplierBody 中的字段并更新供应商信息
  Object.keys(supplierBody).forEach((key) => {
    // 仅更新在供应商模式中定义的字段，防止未定义字段的意外更新
    // if (supplier[key] !== undefined) {
    //   supplier[key] = supplierBody[key];
    // }
    // if (key === 'tags') {
    //   supplier.feedback.findOne({
    //     surveyId: supplier.chooseSurvey
    //   }).sortBy('date')[0].tags = supplierBody[key];
    // }
    // 如果key是tags，那么找出最新的一个surveyId和supplier.chooseSurvey相同的feedback，然后更新tags
    if (key === 'tags' || key === 'reply') {
      const feedback = supplier.feedback.filter(f => f.surveyId === supplier.chooseSurvey);
      if (feedback.length > 0) {
        feedback.sort((a, b) => new Date(b.date) - new Date(a.date));
        feedback[0][key] = supplierBody[key];
      } else {
        const feedback = supplier.feedback.filter(f => f.surveyId === null);
        if (feedback.length > 0) {
          feedback.sort((a, b) => new Date(b.date) - new Date(a.date));
          feedback[0][key] = supplierBody[key];
        }
      }
    } else {
      try {
        supplier[key] = supplierBody[key];
      } catch (error) {
        console.log('updateSupplierById Error:', error);
      }
    }
  });
  // 保存更改
  await user.save();
  console.log('Updated Supplier:', supplier);
  return supplier;
};

const updateSuppliersByIds = async (userId, body) => {
  const  { supplierIds, supplierBody } = body;
  // 验证传入的 userId 和 supplierId
  if (!userId || !supplierIds) {
    throw new Error('User ID and Supplier IDs are required');
  }
  // 查找用户
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  // 查找供应商
  supplierIds.forEach(supplierId => {
    const supplier = user.suppliers.id(supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }
    // 遍历 supplierBody 中的字段并更新供应商信息
    Object.keys(supplierBody).forEach((key) => {
      // // 仅更新在供应商模式中定义的字段，防止未定义字段的意外更新
      // if (supplier[key] !== undefined) {
      //   supplier[key] = supplierBody[key];
      // }
      try {
        supplier[key] = supplierBody[key];
      } catch (error) {
        console.log('updateSuppliersByIds Error:', error);
      }
    });
  });
  // 保存更改
  await user.save();
  return user;
};

const deleteSuppliersById = async (id, supplierIds) => {
  const user = await User.findById(id);
  supplierIds.forEach(supplierId => {
    user.suppliers.id(supplierId).remove();
  });
  await user.save();
  return user;
}

/**
 * 
 */
const getSurveyById = async (id) => {
  return User.findById(id).populate('surveys');
}

const createSurvey = async (id, surveyBody) => {  
  const user = await User.findById(id);
  user.surveys.push(surveyBody);
  await user.save();
  return user;
}

const updateSurveyById = async (userId, surveyId, surveyBody) => {
  if (!userId || !surveyId) {
    throw new Error('User ID and Survey ID are required');
  }
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  const survey = user.surveys.id(surveyId);
  if (!survey) {
    throw new Error('Survey not found');
  }
  Object.keys(surveyBody).forEach((key) => {
    if (survey[key] !== undefined) {
      survey[key] = surveyBody[key];
    }
  });
  // [FIXME] 特殊处理，如果传入的是 add_attachments: formData，则将附件添加到 survey.attachments 中
  if (surveyBody.add_attachments) {
    survey.attachments.push(...surveyBody.add_attachments);
  }
  await user.save();
  console.log('Updated Survey:', survey);
  return survey;
}

const deleteSurveysById = async (id, surveyIds) => {
  const user = await User.findById(id);
  surveyIds.forEach(surveyId => {
    user.surveys.id(surveyId).remove();
  });
  await user.save();
  return user;
}

/**
 * Get user by email / username
 * @param {string} value
 * @returns {Promise<User>}
 */
const getUserByEmailOrUsername = async (value) => {
  return User.findOne({ $or: [{ email: value }, { username: value }] });
  // return User.findOne({ email });
};

/**
 * Update user by id
 * @param {ObjectId} userId
 * @param {Object} updateBody
 * @returns {Promise<User>}
 */
const updateUserById = async (userId, updateBody) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  if (updateBody.email && (await User.isEmailTaken(updateBody.email, userId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }
  Object.assign(user, updateBody);
  await user.save();
  return user;
};

/**
 * Delete user by id
 * @param {ObjectId} userId
 * @returns {Promise<User>}
 */
const deleteUserById = async (userId) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  }
  await user.remove();
  return user;
};

module.exports = {
  createUser,
  queryUsers,
  getUserById,
  getUserByEmailOrUsername,
  updateUserById,
  deleteUserById,
  getSuppliersbyId,
  updateSupplierById,
  updateSuppliersByIds,
  deleteSuppliersById,
  createSupplier,
  getSurveyById,
  updateSurveyById,
  deleteSurveysById,
  createSurvey,
  createSupplierBatch
};
