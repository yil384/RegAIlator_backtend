const express = require('express');

const authRoute = require('./auth.route');
const userRoute = require('./user.route');
const videoGroupRoute = require('./videoGroup.route');
const videoRoute = require('./video.route');
const watchLogRoute = require('./watchLog.route');
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
    path: '/video-groups',
    route: videoGroupRoute,
  },
  {
    path: '/videos',
    route: videoRoute,
  },
  {
    path: '/watch-logs',
    route: watchLogRoute,
  },
  {
    path: '/error-logs',
    route: errorLogRoute,
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
