const httpStatus = require('http-status');
const path = require('path');
const catchAsync = require('../utils/catchAsync');
const { authService, userService, tokenService, emailService, materialService } = require('../services');
const pick = require('../utils/pick');

const register = catchAsync(async (req, res) => {
  const user = await userService.createUser(req.body);
  const tokens = await tokenService.generateAuthTokens(user);
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(user);
  await emailService.sendVerificationEmail(user.email, verifyEmailToken);
  res.status(httpStatus.CREATED).send({ user, tokens });
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const user = await authService.loginUserWithEmailOrUsernameAndPassword(email, password);
  const tokens = await tokenService.generateAuthTokens(user);
  res.send({ user, tokens });
});

const logout = catchAsync(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  res.status(httpStatus.NO_CONTENT).send();
});

const refreshTokens = catchAsync(async (req, res) => {
  const tokens = await authService.refreshAuth(req.body.refreshToken);
  res.send({ ...tokens });
});

const forgotPassword = catchAsync(async (req, res) => {
  const resetPasswordToken = await tokenService.generateResetPasswordToken(req.body.email);
  await emailService.sendResetPasswordEmail(req.body.email, resetPasswordToken);
  res.status(httpStatus.NO_CONTENT).send();
  // res.send({ resetPasswordToken });
});

const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.query.token, req.body.password);
  res.status(httpStatus.NO_CONTENT).send();
});

const sendVerificationEmail = catchAsync(async (req, res) => {
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(req.user);
  await emailService.sendVerificationEmail(req.user.email, verifyEmailToken);
  res.status(httpStatus.NO_CONTENT).send();
  // res.send({ verifyEmailToken });
});

const sendReplyEmail = catchAsync(async (req, res) => {
  const user = await userService.getSuppliersbyId(req.user.id);
  await emailService.sendReplyEmail(req.body.email, req.body.subject, req.body.content, user.email);
  res.send({ message: 'Reply email sent' });
});

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
    const attachments = (survey.attachments || []).map((attachment) => ({
      filename: attachment.filename,
      size: attachment.size,
      contentType: attachment.contentType,
      path: path.join(__dirname, '../..', attachment.content.replace('/api/uploads/', 'uploads/')),
    }));

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

const getMySuppliers = catchAsync(async (req, res) => {
  const user = await userService.getSuppliersbyId(req.user.id);
  const { suppliers } = user;
  res.send(suppliers);
});

const createSupplier = catchAsync(async (req, res) => {
  const user = await userService.createSupplier(req.user.id, req.body);
  const { suppliers } = user;
  res.send(suppliers);
});

const createSupplierBatch = catchAsync(async (req, res) => {
  const user = await userService.createSupplierBatch(req.user.id, req.body);
  const { suppliers } = user;
  res.send(suppliers);
});

const updateSupplier = catchAsync(async (req, res) => {
  const supplier = await userService.updateSupplierById(req.user.id, req.params.supplierId, req.body);
  res.send(supplier);
});

const updateSuppliers = catchAsync(async (req, res) => {
  const user = await userService.updateSuppliersByIds(req.user.id, req.body);
  const { suppliers } = user;
  res.send(suppliers);
});

const deleteSuppliers = catchAsync(async (req, res) => {
  const user = await userService.deleteSuppliersById(req.user.id, req.body.supplierIds);
  const { suppliers } = user;
  res.send(suppliers);
});

const getMySurveys = catchAsync(async (req, res) => {
  const user = await userService.getSurveyById(req.user.id);
  const { surveys } = user;
  res.send(surveys);
});

const createSurvey = async (req, res) => {
  const surveyData = {
    ...req.body,
    attachments: [], // 初始化附件数组
  };

  // 处理上传的文件
  if (req.files) {
    surveyData.attachments = req.files.map((file) => ({
      content: `/api/uploads/${file.filename}`, // 根据您的存储方式调整
      filename: file.originalname,
      size: file.size,
      contentType: file.mimetype,
    }));
  }

  const user = await userService.createSurvey(req.user.id, surveyData);
  const { surveys } = user;
  res.send(surveys);
};

const updateSurveyAttachments = catchAsync(async (req, res) => {
  const surveyData = {
    add_attachments: [], // 初始化附件数组
  };
  // 处理上传的文件
  if (req.files) {
    surveyData.add_attachments = req.files.map((file) => ({
      content: `/api/uploads/${file.filename}`, // 根据您的存储方式调整
      filename: file.originalname,
      size: file.size,
      contentType: file.mimetype,
    }));
  }
  const user = await userService.updateSurveyById(req.user.id, req.params.surveyId, surveyData);
  const { surveys } = user;
  res.send(surveys);
});

const updateSurvey = catchAsync(async (req, res) => {
  const user = await userService.updateSurveyById(req.user.id, req.params.surveyId, req.body);
  const { surveys } = user;
  res.send(surveys);
});

const deleteSurveys = catchAsync(async (req, res) => {
  const user = await userService.deleteSurveysById(req.user.id, req.body.surveyIds);
  const { surveys } = user;
  res.send(surveys);
});

const verifyEmail = catchAsync(async (req, res) => {
  await authService.verifyEmail(req.query.token);
  res.status(httpStatus.NO_CONTENT).send();
});

const getMyBillOfMaterials = catchAsync(async (req, res) => {
  req.query.user = req.user.id;
  const filter = pick(req.query, ['user', 'supplier', 'material', 'addedBy']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await materialService.queryBillOfMaterials(filter, options);
  res.send(result);
});

const createBillOfMaterial = catchAsync(async (req, res) => {
  const result = await materialService.createBillOfMaterial(req.user.id, req.body);
  res.send(result);
});

const createBillOfMaterialsBatch = catchAsync(async (req, res) => {
  const result = await materialService.createBillOfMaterialsBatch(req.user.id, req.body);
  res.send(result);
});

const updateBillOfMaterial = catchAsync(async (req, res) => {
  const result = await materialService.updateBillOfMaterialById(req.user.id, req.params.billOfMaterialId, req.body);
  res.send(result);
});

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
