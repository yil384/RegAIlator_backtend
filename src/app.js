/**
 * @module app
 * @description Express application setup and middleware pipeline.
 *
 * Middleware is applied in a specific order that matters:
 *
 * 1. **Logging** (morgan) -- log every request before anything else processes it.
 * 2. **Security** (helmet, xss, mongoSanitize) -- harden headers, strip XSS
 *    payloads, and remove MongoDB operator injection ($gt, $ne, etc.) BEFORE
 *    the request body reaches any route handler.
 * 3. **Body parsing** (express.json, express.urlencoded) -- parse request bodies
 *    so downstream middleware and routes can access req.body.
 * 4. **Compression** (gzip) -- compress responses for faster transfer.
 * 5. **CORS** -- allow cross-origin requests from the frontend.
 * 6. **Authentication** (passport JWT) -- initialize passport so route-level
 *    `auth()` middleware can verify tokens. Does NOT protect all routes globally.
 * 7. **Rate limiting** -- applied only to `/api/v1/auth` in production to
 *    throttle brute-force login/registration attempts.
 * 8. **Routes** -- API v1 routes and static file serving.
 * 9. **Error handling** -- 404 catch-all, error normalization, and final handler.
 */
const express = require('express');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const cors = require('cors');
const passport = require('passport');
const httpStatus = require('http-status');
const path = require('path');

const config = require('./configs/config');
const morgan = require('./configs/morgan');
const { jwtStrategy } = require('./configs/passport');
const { authLimiter } = require('./middlewares/rateLimiter');
const routes = require('./routes/v1');
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError = require('./utils/ApiError');

const app = express();

// --- 1. Request logging (disabled during tests to keep test output clean) ---
if (config.env !== 'test') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// --- 2. Security hardening ---
// Helmet sets various HTTP headers (X-Content-Type-Options, X-Frame-Options, etc.)
app.use(helmet());

// --- 3. Body parsing ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 2b. Input sanitization (runs after body parsing so req.body is available) ---
// Strip HTML/JS tags from request body/query/params to prevent XSS
app.use(xss());
// Remove MongoDB query operators ($gt, $ne, etc.) from user input to prevent NoSQL injection
app.use(mongoSanitize());

// --- 4. Response compression ---
app.use(compression());

// --- 5. CORS ---
const corsOptions = {
  origin: config.web_host || '*',
  credentials: true,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// --- 6. Authentication ---
// Initialize Passport but do NOT apply auth globally -- individual routes opt in
// via the `auth()` middleware defined in middlewares/auth.js.
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

// --- 7. Rate limiting (production only) ---
if (config.env === 'production') {
  app.use('/api/v1/auth', authLimiter);
}

// --- 8. Routes and static file serving ---
// All API routes are versioned under /api/v1
app.use('/api/v1', routes);

// Static file directories for uploaded files, email attachments, and recordings.
// These paths correspond to the URL prefixes stored in database records
// (e.g., a Video with path "/api/uploads/abc.pdf" is served from here).
app.use('/api/recordings', express.static(path.resolve('recordings')));
app.use('/api/uploads', express.static(path.resolve('uploads')));
app.use('/api/attachments', express.static(path.resolve('attachments')));

// Simple health-check endpoint
app.use('/api/', (req, res) => {
  res.send('Hello from XRi API!');
});

// --- 9. Error handling ---
// Catch-all: any request that did not match a route above gets a 404
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// Normalize non-ApiError errors (e.g., Mongoose validation errors) into ApiError format
app.use(errorConverter);

// Final error handler: logs the error and sends the appropriate HTTP response
app.use(errorHandler);

module.exports = app;
