/**
 * @module services/user
 * @description Core service for managing users, suppliers, and surveys.
 *
 * Data architecture note: Suppliers and surveys are embedded as subdocument
 * arrays inside each User document rather than stored in separate collections.
 * This design keeps all of a user's domain data in a single document, which
 * simplifies queries (no cross-collection joins) and ensures atomic updates
 * when modifying a user's supplier list or survey templates. The tradeoff is
 * that individual supplier/survey updates require loading the parent User
 * document first.
 *
 * Relationship chain: User -> suppliers[] -> feedback[] (email replies)
 *                     User -> surveys[]   (reusable survey templates)
 *
 * Suppliers link to surveys via `chooseSurvey` (an ObjectId pointing at one of
 * the user's survey subdocuments). Feedback entries on a supplier are tagged
 * with the `surveyId` they relate to, enabling per-survey filtering.
 */
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

/**
 * Add a single supplier subdocument to a user.
 * Initializes the feedback array as empty and normalizes `chooseSurvey`
 * (the frontend may send an empty string instead of null when no survey is selected).
 * @param {ObjectId} id - The owning user's ID
 * @param {Object} supplierBody - Supplier fields (supplierName, contact, etc.)
 * @returns {Promise<User>} The updated user document (with the new supplier appended)
 */
const createSupplier = async (id, supplierBody) => {
  // Normalize empty string to null (frontend sends '' when no survey is selected)
  if (supplierBody.chooseSurvey==='') {
    supplierBody.chooseSurvey = null;
  }
  supplierBody.feedback = [];

  const user = await User.findById(id);
  user.suppliers.push(supplierBody);
  await user.save();
  return user;
}

/**
 * Add multiple suppliers to a user in a single save operation (e.g., CSV import).
 * Each supplier is normalized the same way as {@link createSupplier}.
 * @param {ObjectId} id - The owning user's ID
 * @param {Object[]} supplierBodies - Array of supplier field objects
 * @returns {Promise<User>} The updated user document
 */
const createSupplierBatch = async (id, supplierBodies) => {
  const user = await User.findById(id);
  for (let supplierBody of supplierBodies) {
    // Normalize empty string to null (frontend sends '' when no survey is selected)
    if (supplierBody.chooseSurvey==='') {
      supplierBody.chooseSurvey = null;
    }
    supplierBody.feedback = [];
    user.suppliers.push(supplierBody);
  }
  await user.save();
  return user;
}

/**
 * Update a single supplier's fields within a user document.
 *
 * Special handling for `tags` and `reply`: these fields live on the most recent
 * feedback entry (email reply) for the supplier's currently chosen survey, NOT
 * on the supplier itself. This is because tags and AI-generated replies are
 * per-feedback-round data. The function finds the newest feedback whose
 * `surveyId` matches `supplier.chooseSurvey`, then writes to that feedback
 * entry. Falls back to feedback with a null surveyId if no survey-matched
 * feedback exists.
 *
 * @param {ObjectId} userId - The owning user's ID
 * @param {ObjectId} supplierId - The target supplier subdocument's _id
 * @param {Object} supplierBody - Key/value pairs to update
 * @returns {Promise<Object>} The updated supplier subdocument
 * @throws {Error} If user or supplier is not found
 */
const updateSupplierById = async (userId, supplierId, supplierBody) => {
  // Validate the incoming userId and supplierId
  if (!userId || !supplierId) {
    throw new Error('User ID and Supplier ID are required');
  }
  // Find the user
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  // Find the supplier
  const supplier = user.suppliers.id(supplierId);
  if (!supplier) {
    throw new Error('Supplier not found');
  }
  // Iterate over fields in supplierBody and update supplier information
  Object.keys(supplierBody).forEach((key) => {
    // Tags and reply live on the most recent feedback entry, not on the supplier itself
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
      supplier[key] = supplierBody[key];
    }
  });
  await user.save();
  return supplier;
};

/**
 * Bulk-update the same set of fields across multiple suppliers (e.g., assigning
 * the same survey or status to a batch selection in the UI).
 * Unlike {@link updateSupplierById}, this does NOT handle `tags`/`reply`
 * specially -- it overwrites supplier-level fields directly.
 * @param {ObjectId} userId - The owning user's ID
 * @param {Object} body - Contains `supplierIds` (string[]) and `supplierBody` (Object)
 * @returns {Promise<User>} The updated user document
 * @throws {Error} If user or any supplier is not found
 */
const updateSuppliersByIds = async (userId, body) => {
  const  { supplierIds, supplierBody } = body;
  // Validate the incoming userId and supplierIds
  if (!userId || !supplierIds) {
    throw new Error('User ID and Supplier IDs are required');
  }
  // Find the user
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  // Find the suppliers
  supplierIds.forEach(supplierId => {
    const supplier = user.suppliers.id(supplierId);
    if (!supplier) {
      throw new Error('Supplier not found');
    }
    Object.keys(supplierBody).forEach((key) => {
      supplier[key] = supplierBody[key];
    });
  });
  // Save changes
  await user.save();
  return user;
};

/**
 * Remove one or more supplier subdocuments from a user by their IDs.
 * @param {ObjectId} id - The owning user's ID
 * @param {ObjectId[]} supplierIds - Array of supplier subdocument _id values to remove
 * @returns {Promise<User>} The updated user document (with suppliers removed)
 */
const deleteSuppliersById = async (id, supplierIds) => {
  const user = await User.findById(id);
  supplierIds.forEach(supplierId => {
    user.suppliers.id(supplierId).remove();
  });
  await user.save();
  return user;
}

/**
 * Get a user document with its surveys array populated.
 * Despite the name, this returns the full user -- callers typically
 * destructure `user.surveys` from the result.
 * @param {ObjectId} id - The user's ID
 * @returns {Promise<User>} The user document with populated surveys
 */
const getSurveyById = async (id) => {
  return User.findById(id).populate('surveys');
}

/**
 * Create a new survey subdocument inside a user document.
 * Surveys are reusable email templates that can be assigned to suppliers
 * via the supplier's `chooseSurvey` field.
 * @param {ObjectId} id - The owning user's ID
 * @param {Object} surveyBody - Survey fields (title, html, attachments, etc.)
 * @returns {Promise<User>} The updated user document
 */
const createSurvey = async (id, surveyBody) => {
  const user = await User.findById(id);
  user.surveys.push(surveyBody);
  await user.save();
  return user;
}

/**
 * Update a survey subdocument's fields within a user document.
 * Handles a special `add_attachments` key: when present, the provided
 * attachments are *appended* to the existing list rather than replacing it.
 * This allows incremental attachment uploads without losing previous files.
 * @param {ObjectId} userId - The owning user's ID
 * @param {ObjectId} surveyId - The target survey subdocument's _id
 * @param {Object} surveyBody - Key/value pairs to update; may include `add_attachments`
 * @returns {Promise<Object>} The updated survey subdocument
 * @throws {Error} If user or survey is not found
 */
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
  // Append new attachments to existing list (for incremental upload via formData)
  if (surveyBody.add_attachments) {
    survey.attachments.push(...surveyBody.add_attachments);
  }
  await user.save();
  return survey;
}

/**
 * Remove one or more survey subdocuments from a user by their IDs.
 * @param {ObjectId} id - The owning user's ID
 * @param {ObjectId[]} surveyIds - Array of survey subdocument _id values to remove
 * @returns {Promise<User>} The updated user document (with surveys removed)
 */
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
