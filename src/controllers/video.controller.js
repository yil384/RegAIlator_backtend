/**
 * @module controllers/video
 * @description Handles file uploads, CRUD operations for "Video" records, and
 * PDF parsing via a Python script.
 *
 * Naming note: The "Video" model is a general-purpose file record -- it stores
 * any uploaded document (PDF, XLSX, images, etc.), not just video files. The
 * name is historical. Each record tracks the file path, the user who uploaded
 * it, an optional parsed-data JSON blob, and an optional supplier association.
 *
 * Upload flow: files are saved to `uploads/` with UUID filenames (to prevent
 * collisions and path-traversal issues), then a Video document is created
 * pointing to `/api/uploads/<uuid>.pdf`.
 *
 * Parse flow: the `parseVideos` endpoint takes an array of Video IDs, checks
 * if parsed data already exists (cached in `video.json`), and for PDFs without
 * cached data, invokes a Python script (`parse_files.py`) to extract structured
 * content.
 */
const httpStatus = require('http-status');
const multer = require('multer');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { videoService } = require('../services');
const config = require('../configs/config');
const { removeVideoFile } = require('../utils/removeVideoFile');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Used to generate unique filenames
const { spawn } = require('child_process');
const mime = require('mime'); // Import mime module

/**
 * Multer disk storage configuration.
 * Files are written to the `uploads/` directory with UUID-based filenames
 * to avoid name collisions and directory traversal attacks.
 */
const fileStorage = multer.diskStorage({
  destination(req, file, callback) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    callback(null, uploadDir);
  },
  filename(req, file, callback) {
    const uniqueFileName = `${uuidv4()}.pdf`;
    callback(null, uniqueFileName);
  },
});

/** Multer middleware accepting up to 100 files under the 'file' field name. */
const uploadVideos = multer({ storage: fileStorage }).array('file', 100);

/**
 * Create a Video record directly from a JSON body (no file upload).
 * Automatically sets `addedBy` to the authenticated user.
 * @route POST /videos
 */
const createVideo = catchAsync(async (req, res) => {
  const reqBody = {
    ...req.body,
    addedBy: req.user._id,
  };
  const videoGroup = await videoService.createVideo(reqBody);
  res.status(httpStatus.CREATED).send(videoGroup);
});

/**
 * Query Video records with optional filters (name, path, group, addedBy, accessState)
 * and pagination (sortBy, limit, page).
 * @route GET /videos
 */
const getVideos = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['name', 'path', 'group', 'addedBy', 'accessState']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await videoService.queryVideos(filter, options);
  res.send(result);
});

/**
 * Get a single Video record by ID.
 * @route GET /videos/:videoId
 */
const getVideo = catchAsync(async (req, res) => {
  const user = await videoService.getVideoById(req.params.videoId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Video not found');
  }
  res.send(user);
});

/**
 * Update a Video record's fields by ID.
 * @route PATCH /videos/:videoId
 */
const updateVideo = catchAsync(async (req, res) => {
  const user = await videoService.updateVideoById(req.params.videoId, req.body);
  res.send(user);
});

/**
 * Delete a Video record by ID.
 * @route DELETE /videos/:videoId
 */
const deleteVideo = catchAsync(async (req, res) => {
  await videoService.deleteVideoById(req.params.videoId);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Upload one or more files for a specific supplier, saving each to disk and
 * creating a Video record in the database. The multer middleware is invoked
 * manually (not as route-level middleware) so we can handle its errors within
 * this function's try/catch. Each uploaded file gets a UUID filename and is
 * associated with the supplier via the :supplierId route parameter.
 *
 * Note: The commented-out PDF parsing block was disabled in favor of the
 * separate `parseVideos` endpoint, which allows on-demand parsing.
 *
 * @route POST /videos/upload/:supplierId
 */
const uploadFiles = catchAsync(async (req, res) => {
  const supplierId = req.params.supplierId;
  return uploadVideos(req, res, async function (err) {
      try {
          if (err instanceof multer.MulterError) {
              return res.status(500).send({ error: { message: `Multer uploading error: ${err.message}` } });
          }
          if (err) {
              return res.status(500).send({ error: { message: `unknown uploading error: ${err.message}` } });
          }

          if (req.files && req.files.length) {
              const results = [];
              for (const file of req.files) {
                  const fileUrl = `/api/uploads/${file.filename}`;

                  // Store file record; actual PDF parsing is done later via the parseVideos endpoint
                  await videoService.createVideo({
                    title: file.originalname,
                    path: fileUrl,
                    group: req.body.group,
                    accessState: "private",
                    addedBy: req.user._id,
                    supplier: supplierId,
                    json: {},
                  });
                  results.push({ file: file.filename, result: {} });
              }
              res.status(200).json({
                status: true,
                message: 'Files processed successfully',
                files: results,
              });
          } else {
              res.status(400).send({ message: 'No files uploaded' });
          }
      } catch (e) {
          console.error(e);
          res.status(500).send({ error: { message: 'Internal server error' } });
      }
  });
});

/**
 * Parse one or more uploaded files by their Video record IDs.
 * For each video:
 *  - If `video.json` already has data, return the cached result (skip re-parsing).
 *  - If the file is a PDF, spawn `parse_files.py` to extract structured data,
 *    then persist the result back to `video.json` for future cache hits.
 *  - For non-PDF files, return an empty result object.
 * All files are processed in parallel via Promise.all.
 * @route POST /videos/parse
 */
const parseVideos = catchAsync(async (req, res) => {
  const ids = req.body;
  const videos = await videoService.queryVideos({ _id: { $in: ids } }, {});
  const results = [];
  let responseSent = false;

  const sendResponseIfComplete = () => {
    if (!responseSent && results.length === videos.results.length) {
      responseSent = true;
      res.status(200).json({
        status: true,
        message: 'Files processed successfully',
        files: results,
      });
    }
  };

  const parsePromises = videos.results.map((video) => {
    return new Promise((resolve) => {
      const filePath = path.join(__dirname, '../..', video.path).replace('/api', '');
      const type = path.extname(video.title).slice(1);

      if (video.json && Object.keys(video.json).length) {
        results.push({ file: video.title, result: video.json });
        resolve();
      } else if (type === 'application/pdf' || type === 'pdf') {
        const pythonProcess = spawn('python', [path.join(__dirname, '../python/parse_files.py'), filePath]);
        let pythonOutput = '';

        pythonProcess.stdout.on('data', (data) => {
          pythonOutput += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          console.error(`stderr: ${data}`);
        });

        pythonProcess.on('close', async (code) => {
          try {
            if (code === 0) {
              const parsedData = JSON.parse(pythonOutput);
              await videoService.updateVideoById(video._id, { json: parsedData });
              results.push({ file: video.title, result: parsedData });
            } else {
              console.error(`Error processing file with Python script: ${video.title}`);
              results.push({ file: video.title, result: {}, error: 'Parse failed' });
            }
          } catch (e) {
            console.error(`Error handling parse result for ${video.title}:`, e);
            results.push({ file: video.title, result: {}, error: 'Parse error' });
          }
          resolve();
        });
      } else {
        results.push({ file: video.title, result: {} });
        resolve();
      }
    });
  });

  await Promise.all(parsePromises);
  sendResponseIfComplete();
});

module.exports = {
  createVideo,
  getVideos,
  getVideo,
  updateVideo,
  deleteVideo,
  uploadFiles,
  uploadVideos,
  parseVideos,
};
