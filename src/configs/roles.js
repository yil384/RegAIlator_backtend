const { Survey } = require('../models');

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
  videoGroup: {
    getVideoGroups: 'getVideoGroups',
    manageVideoGroups: 'manageVideoGroups',
    all: ['getVideoGroups', 'manageVideoGroups'],
  },
  video: {
    getVideo: 'getVideo',
    manageVideo: 'manageVideo',
    all: ['getVideo', 'manageVideo'],
  },
  watchLog: {
    getWatchLog: 'getWatchLog',
    manageWatchLog: 'manageWatchLog',
    all: ['getWatchLog', 'manageWatchLog'],
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
    ...accessCategories.videoGroup.all,
    ...accessCategories.video.all,
    ...accessCategories.watchLog.all,
    ...accessCategories.errorLog.all,
  ],
  [subUserRoles.user]: [
    ...accessCategories.user.all, 
    ...accessCategories.videoGroup.all, 
    ...accessCategories.video.all
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
