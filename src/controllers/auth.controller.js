/**
 * @module controllers/auth
 * @description Handles authentication, authorization, and all user-scoped
 * resource management (suppliers, surveys, bill of materials).
 *
 * Despite its name, this controller covers more than auth -- it also serves
 * as the "me" controller for the currently authenticated user's own data.
 * This is because suppliers and surveys are embedded in the User document,
 * so they share the same auth context (req.user).
 *
 * All handlers use {@link catchAsync} to forward errors to the global error handler.
 */
const httpStatus = require('http-status');
const path = require('path');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { authService, userService, tokenService, emailService, materialService } = require('../services');
const pick = require('../utils/pick');

/**
 * Register a new user account.
 * Creates the user, generates JWT auth tokens, and immediately sends a
 * verification email. The user is returned along with tokens so the
 * frontend can log them in right away (email verification is deferred).
 * @route POST /auth/register
 */
const register = catchAsync(async (req, res) => {
  const user = await userService.createUser(req.body);
  const tokens = await tokenService.generateAuthTokens(user);
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(user);
  await emailService.sendVerificationEmail(user.email, verifyEmailToken);
  res.status(httpStatus.CREATED).send({ user, tokens });
});

/**
 * Log in with email/username and password.
 * Accepts either an email address or username in the `email` field for flexibility.
 * Returns the user object and fresh JWT access + refresh tokens.
 * @route POST /auth/login
 */
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const user = await authService.loginUserWithEmailOrUsernameAndPassword(email, password);
  const tokens = await tokenService.generateAuthTokens(user);
  res.send({ user, tokens });
});

/**
 * Log out by invalidating the provided refresh token.
 * @route POST /auth/logout
 */
const logout = catchAsync(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Exchange a valid refresh token for a new access + refresh token pair.
 * @route POST /auth/refresh-tokens
 */
const refreshTokens = catchAsync(async (req, res) => {
  const tokens = await authService.refreshAuth(req.body.refreshToken);
  res.send({ ...tokens });
});

/**
 * Initiate the password reset flow by generating a reset token and emailing it.
 * Returns 204 regardless of whether the email exists (to prevent user enumeration).
 * @route POST /auth/forgot-password
 */
const forgotPassword = catchAsync(async (req, res) => {
  const resetPasswordToken = await tokenService.generateResetPasswordToken(req.body.email);
  await emailService.sendResetPasswordEmail(req.body.email, resetPasswordToken);
  res.status(httpStatus.NO_CONTENT).send();
  // res.send({ resetPasswordToken });
});

/**
 * Complete the password reset by validating the token and setting the new password.
 * The token arrives as a query parameter (from the email link).
 * @route POST /auth/reset-password?token=...
 */
const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.query.token, req.body.password);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Re-send the email verification link for the currently authenticated user.
 * Useful when the original verification email was lost or expired.
 * @route POST /auth/send-verification-email
 */
const sendVerificationEmail = catchAsync(async (req, res) => {
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(req.user);
  await emailService.sendVerificationEmail(req.user.email, verifyEmailToken);
  res.status(httpStatus.NO_CONTENT).send();
  // res.send({ verifyEmailToken });
});

/**
 * Send a reply email to a supplier on behalf of the authenticated user.
 * The user's own email is passed as the "from" address so replies come back
 * to the monitored IMAP mailbox for that user.
 * @route POST /auth/send-reply-email
 */
const sendReplyEmail = catchAsync(async (req, res) => {
  const user = await userService.getSuppliersbyId(req.user.id);
  await emailService.sendReplyEmail(req.body.email, req.body.subject, req.body.content, user.email);
  res.send({ message: 'Reply email sent' });
});

/**
 * Send a survey/mention email to a supplier.
 * If no survey is provided in the request body, sends a default placeholder
 * email. Otherwise, loads the survey from the user's surveys, resolves
 * attachment file paths, optionally appends a raw-materials CSV, and sends
 * everything. Path traversal is guarded by checking that resolved paths
 * stay within the uploads directory.
 * @route POST /auth/send-mention-email
 */
const sendMentionEmail = catchAsync(async (req, res) => {
  const user = await userService.getSuppliersbyId(req.user.id);
  if (!req.body.survey) {
    await emailService.sendMentionEmail(
      req.body.email,
      'This is the default title',
      'This is the default content.',
      null,
      user.email
    );
  } else {
    const survey = await user.surveys.id(req.body.survey._id);
    if (!survey) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Survey not found');
    }
    const attachments = (survey.attachments || []).map((attachment) => {
      const relativePath = attachment.content.replace('/api/uploads/', 'uploads/');
      const fullPath = path.join(__dirname, '../..', relativePath);
      const uploadsDir = path.resolve(__dirname, '../../uploads');
      if (!path.resolve(fullPath).startsWith(uploadsDir)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid attachment path');
      }
      return {
        filename: attachment.filename,
        size: attachment.size,
        contentType: attachment.contentType,
        path: fullPath,
      };
    });

    const { rawMaterials } = req.body.survey;
    const finalAttachments = [
      ...attachments,
      ...(rawMaterials
        ? [
            {
              filename: 'RawMaterialsList.csv',
              content: rawMaterials,
            },
          ]
        : []),
    ];
    await emailService.sendMentionEmail(req.body.email, survey.title, survey.html, finalAttachments, user.email);
  }
  res.send({ message: 'Mention email sent' });
});

/**
 * Get all suppliers belonging to the authenticated user.
 * @route GET /auth/suppliers
 */
const getMySuppliers = catchAsync(async (req, res) => {
  const user = await userService.getSuppliersbyId(req.user.id);
  const { suppliers } = user;
  res.send(suppliers);
});

/**
 * Add a single new supplier to the authenticated user's supplier list.
 * Returns the full updated suppliers array so the frontend can refresh in one call.
 * @route POST /auth/suppliers
 */
const createSupplier = catchAsync(async (req, res) => {
  const user = await userService.createSupplier(req.user.id, req.body);
  const { suppliers } = user;
  res.send(suppliers);
});

/**
 * Add multiple suppliers at once (e.g., CSV/Excel import).
 * @route POST /auth/suppliers/batch
 */
const createSupplierBatch = catchAsync(async (req, res) => {
  const user = await userService.createSupplierBatch(req.user.id, req.body);
  const { suppliers } = user;
  res.send(suppliers);
});

/**
 * Update a single supplier by its subdocument ID.
 * @route PATCH /auth/suppliers/:supplierId
 */
const updateSupplier = catchAsync(async (req, res) => {
  const supplier = await userService.updateSupplierById(req.user.id, req.params.supplierId, req.body);
  res.send(supplier);
});

/**
 * Bulk-update multiple suppliers with the same field values.
 * @route PATCH /auth/suppliers
 */
const updateSuppliers = catchAsync(async (req, res) => {
  const user = await userService.updateSuppliersByIds(req.user.id, req.body);
  const { suppliers } = user;
  res.send(suppliers);
});

/**
 * Delete one or more suppliers by their subdocument IDs.
 * @route DELETE /auth/suppliers
 */
const deleteSuppliers = catchAsync(async (req, res) => {
  const user = await userService.deleteSuppliersById(req.user.id, req.body.supplierIds);
  const { suppliers } = user;
  res.send(suppliers);
});

/**
 * Get all survey templates belonging to the authenticated user.
 * @route GET /auth/surveys
 */
const getMySurveys = catchAsync(async (req, res) => {
  const user = await userService.getSurveyById(req.user.id);
  const { surveys } = user;
  res.send(surveys);
});

/**
 * Create a new survey template. Supports multipart/form-data with file uploads --
 * uploaded files are mapped to the survey's attachments array with `/api/uploads/` URLs.
 * @route POST /auth/surveys
 */
const createSurvey = catchAsync(async (req, res) => {
  const surveyData = {
    ...req.body,
    attachments: [], // Initialize attachments array
  };

  // Process uploaded files
  if (req.files) {
    surveyData.attachments = req.files.map((file) => ({
      content: `/api/uploads/${file.filename}`, // Adjust based on your storage method
      filename: file.originalname,
      size: file.size,
      contentType: file.mimetype,
    }));
  }

  const user = await userService.createSurvey(req.user.id, surveyData);
  const { surveys } = user;
  res.send(surveys);
});

/**
 * Append new file attachments to an existing survey (incremental upload).
 * Uses the `add_attachments` convention recognized by userService.updateSurveyById.
 * @route PATCH /auth/surveys/:surveyId/attachments
 */
const updateSurveyAttachments = catchAsync(async (req, res) => {
  const surveyData = {
    add_attachments: [], // Initialize attachments array
  };
  // Process uploaded files
  if (req.files) {
    surveyData.add_attachments = req.files.map((file) => ({
      content: `/api/uploads/${file.filename}`, // Adjust based on your storage method
      filename: file.originalname,
      size: file.size,
      contentType: file.mimetype,
    }));
  }
  const user = await userService.updateSurveyById(req.user.id, req.params.surveyId, surveyData);
  const { surveys } = user;
  res.send(surveys);
});

/**
 * Update a survey template's fields (title, html, json, etc.) by ID.
 * @route PATCH /auth/surveys/:surveyId
 */
const updateSurvey = catchAsync(async (req, res) => {
  const user = await userService.updateSurveyById(req.user.id, req.params.surveyId, req.body);
  const { surveys } = user;
  res.send(surveys);
});

/**
 * Delete one or more survey templates by their subdocument IDs.
 * @route DELETE /auth/surveys
 */
const deleteSurveys = catchAsync(async (req, res) => {
  const user = await userService.deleteSurveysById(req.user.id, req.body.surveyIds);
  const { surveys } = user;
  res.send(surveys);
});

/**
 * Verify a user's email address using the token from the verification link.
 * @route POST /auth/verify-email?token=...
 */
const verifyEmail = catchAsync(async (req, res) => {
  await authService.verifyEmail(req.query.token);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Query the authenticated user's bill of materials with optional filters and pagination.
 * Supported filter keys: user, supplier, material, addedBy.
 * @route GET /auth/bill-of-materials
 */
const getMyBillOfMaterials = catchAsync(async (req, res) => {
  req.query.user = req.user.id;
  const filter = pick(req.query, ['user', 'supplier', 'material', 'addedBy']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await materialService.queryBillOfMaterials(filter, options);
  res.send(result);
});

/**
 * Create a single bill of material record for the authenticated user.
 * @route POST /auth/bill-of-materials
 */
const createBillOfMaterial = catchAsync(async (req, res) => {
  const result = await materialService.createBillOfMaterial(req.user.id, req.body);
  res.send(result);
});

/**
 * Create multiple bill of material records at once (batch import).
 * @route POST /auth/bill-of-materials/batch
 */
const createBillOfMaterialsBatch = catchAsync(async (req, res) => {
  const result = await materialService.createBillOfMaterialsBatch(req.user.id, req.body);
  res.send(result);
});

/**
 * Update a bill of material record by its document ID.
 * @route PATCH /auth/bill-of-materials/:billOfMaterialId
 */
const updateBillOfMaterial = catchAsync(async (req, res) => {
  const result = await materialService.updateBillOfMaterialById(req.user.id, req.params.billOfMaterialId, req.body);
  res.send(result);
});

/**
 * Delete one or more bill of material records by their document IDs.
 * @route DELETE /auth/bill-of-materials
 */
const deleteBillOfMaterials = catchAsync(async (req, res) => {
  const result = await materialService.deleteBillOfMaterialsByIds(req.user.id, req.body);
  res.send(result);
});

module.exports = {
  register,
  login,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  sendMentionEmail,
  sendReplyEmail,
  verifyEmail,
  getMySuppliers,
  createSupplier,
  updateSupplier,
  updateSuppliers,
  deleteSuppliers,
  getMySurveys,
  createSurvey,
  updateSurvey,
  deleteSurveys,
  createSupplierBatch,
  updateSurveyAttachments,
  getMyBillOfMaterials,
  createBillOfMaterial,
  createBillOfMaterialsBatch,
  updateBillOfMaterial,
  deleteBillOfMaterials,
};
