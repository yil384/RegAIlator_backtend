const subUserRoles = {
  user: 'user',
  admin: 'admin',
  guest: 'guest',
};

const accessCategories = {
  user: {
    getUsers: 'getUsers',
    manageUsers: 'manageUsers',
    all: ['getUsers', 'manageUsers'],
  },
  documentGroup: {
    getDocumentGroups: 'getDocumentGroups',
    manageDocumentGroups: 'manageDocumentGroups',
    all: ['getDocumentGroups', 'manageDocumentGroups'],
  },
  document: {
    getDocument: 'getDocument',
    manageDocument: 'manageDocument',
    all: ['getDocument', 'manageDocument'],
  },
  auditLog: {
    getAuditLog: 'getAuditLog',
    manageAuditLog: 'manageAuditLog',
    all: ['getAuditLog', 'manageAuditLog'],
  },
  errorLog: {
    getErrorLog: 'getErrorLog',
    manageErrorLog: 'manageErrorLog',
    all: ['getErrorLog', 'manageErrorLog'],
  },
  survey: {
    getSurveyTemplates: 'getSurveyTemplates',
    manageSurveyTemplates: 'manageSurveyTemplates',
    all: ['getSurveyTemplates', 'manageSurveyTemplates'],
  },
};

const allRoles = {
  [subUserRoles.admin]: [
    ...accessCategories.user.all,
    ...accessCategories.documentGroup.all,
    ...accessCategories.document.all,
    ...accessCategories.auditLog.all,
    ...accessCategories.errorLog.all,
  ],
  [subUserRoles.user]: [
    ...accessCategories.user.all,
    ...accessCategories.documentGroup.all,
    ...accessCategories.document.all,
  ],
  [subUserRoles.guest]: [],
};

const roles = Object.keys(allRoles);

const roleRights = new Map(Object.entries(allRoles));

module.exports = {
  roles,
  roleRights,
  subUserRoles,
  accessCategories,
};
