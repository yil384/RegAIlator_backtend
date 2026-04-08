const express = require('express');

const authRoute = require('./auth.route');
const userRoute = require('./user.route');
const documentGroupRoute = require('./documentGroup.route');
const documentRoute = require('./document.route');
const auditLogRoute = require('./auditLog.route');
const errorLogRoute = require('./errorLog.route');

const docsRoute = require('./docs.route');
const config = require('../../configs/config');

const router = express.Router();

const defaultRoutes = [
  {
    path: '/auth',
    route: authRoute,
  },
  {
    path: '/users',
    route: userRoute,
  },
  {
    path: '/document-groups',
    route: documentGroupRoute,
  },
  {
    path: '/documents',
    route: documentRoute,
  },
  {
    path: '/audit-logs',
    route: auditLogRoute,
  },
  {
    path: '/error-logs',
    route: errorLogRoute,
  },
  // Backwards-compatible aliases (old frontend still uses these paths)
  {
    path: '/video-groups',
    route: documentGroupRoute,
  },
  {
    path: '/videos',
    route: documentRoute,
  },
  {
    path: '/watch-logs',
    route: auditLogRoute,
  },
];

const devRoutes = [
  // routes available only in development mode
  {
    path: '/docs',
    route: docsRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

/* istanbul ignore next */
if (config.env === 'development') {
  devRoutes.forEach((route) => {
    router.use(route.path, route.route);
  });
}

module.exports = router;
