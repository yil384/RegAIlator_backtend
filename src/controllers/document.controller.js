/**
 * @module controllers/document
 * @description Handles file uploads, CRUD operations for "Document" records, and
 * PDF parsing via a Python script.
 *
 * Each record tracks the file path, the user who uploaded
 * it, an optional parsed-data JSON blob, and an optional supplier association.
 *
 * Upload flow: files are saved to `uploads/` with UUID filenames (to prevent
 * collisions and path-traversal issues), then a Document record is created
 * pointing to `/api/uploads/<uuid>.pdf`.
 *
 * Parse flow: the `parseDocuments` endpoint takes an array of Document IDs, checks
 * if parsed data already exists (cached in `document.json`), and for PDFs without
 * cached data, invokes a Python script (`parse_files.py`) to extract structured
 * content.
 */
const httpStatus = require('http-status');
const multer = require('multer');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { documentService } = require('../services');
const config = require('../configs/config');
const logger = require('../configs/logger');
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
const uploadFiles = multer({ storage: fileStorage }).array('file', 100);

/**
 * Create a Document record directly from a JSON body (no file upload).
 * Automatically sets `addedBy` to the authenticated user.
 * @route POST /documents
 */
const createDocument = catchAsync(async (req, res) => {
  const reqBody = {
    ...req.body,
    addedBy: req.user._id,
  };
  const document = await documentService.createDocument(reqBody);
  res.status(httpStatus.CREATED).send(document);
});

/**
 * Query Document records with optional filters (name, path, group, addedBy, accessState)
 * and pagination (sortBy, limit, page).
 * @route GET /documents
 */
const getDocuments = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['name', 'path', 'group', 'addedBy', 'accessState']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await documentService.queryDocuments(filter, options);
  res.send(result);
});

/**
 * Get a single Document record by ID.
 * @route GET /documents/:documentId
 */
const getDocument = catchAsync(async (req, res) => {
  const document = await documentService.getDocumentById(req.params.documentId);
  if (!document) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Document not found');
  }
  res.send(document);
});

/**
 * Update a Document record's fields by ID.
 * @route PATCH /documents/:documentId
 */
const updateDocument = catchAsync(async (req, res) => {
  const document = await documentService.updateDocumentById(req.params.documentId, req.body);
  res.send(document);
});

/**
 * Delete a Document record by ID.
 * @route DELETE /documents/:documentId
 */
const deleteDocument = catchAsync(async (req, res) => {
  await documentService.deleteDocumentById(req.params.documentId);
  res.status(httpStatus.NO_CONTENT).send();
});

/**
 * Upload one or more files for a specific supplier, saving each to disk and
 * creating a Document record in the database. The multer middleware is invoked
 * manually (not as route-level middleware) so we can handle its errors within
 * this function's try/catch. Each uploaded file gets a UUID filename and is
 * associated with the supplier via the :supplierId route parameter.
 *
 * @route POST /documents/upload/:supplierId
 */
const uploadDocumentFiles = catchAsync(async (req, res) => {
  const supplierId = req.params.supplierId;
  return uploadFiles(req, res, async function (err) {
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

                  // Store file record; actual PDF parsing is done later via the parseDocuments endpoint
                  await documentService.createDocument({
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
          logger.error(e);
          res.status(500).send({ error: { message: 'Internal server error' } });
      }
  });
});

/**
 * Parse one or more uploaded files by their Document record IDs.
 * For each document:
 *  - If `document.json` already has data, return the cached result (skip re-parsing).
 *  - If the file is a PDF, spawn `parse_files.py` to extract structured data,
 *    then persist the result back to `document.json` for future cache hits.
 *  - For non-PDF files, return an empty result object.
 * All files are processed in parallel via Promise.all.
 * @route POST /documents/parse
 */
const parseDocuments = catchAsync(async (req, res) => {
  const ids = req.body;
  const documents = await documentService.queryDocuments({ _id: { $in: ids } }, {});
  const results = [];
  let responseSent = false;

  const sendResponseIfComplete = () => {
    if (!responseSent && results.length === documents.results.length) {
      responseSent = true;
      res.status(200).json({
        status: true,
        message: 'Files processed successfully',
        files: results,
      });
    }
  };

  const parsePromises = documents.results.map((document) => {
    return new Promise((resolve) => {
      const filePath = path.join(__dirname, '../..', document.path).replace('/api', '');
      const type = path.extname(document.title).slice(1);

      if (document.json && Object.keys(document.json).length) {
        results.push({ file: document.title, result: document.json });
        resolve();
      } else if (type === 'application/pdf' || type === 'pdf') {
        const pythonProcess = spawn('python', [path.join(__dirname, '../python/parse_files.py'), filePath]);
        let pythonOutput = '';

        pythonProcess.stdout.on('data', (data) => {
          pythonOutput += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          logger.error(`stderr: ${data}`);
        });

        pythonProcess.on('close', async (code) => {
          try {
            if (code === 0) {
              const parsedData = JSON.parse(pythonOutput);
              await documentService.updateDocumentById(document._id, { json: parsedData });
              results.push({ file: document.title, result: parsedData });
            } else {
              logger.error(`Error processing file with Python script: ${document.title}`);
              results.push({ file: document.title, result: {}, error: 'Parse failed' });
            }
          } catch (e) {
            logger.error(`Error handling parse result for ${document.title}:`, e);
            results.push({ file: document.title, result: {}, error: 'Parse error' });
          }
          resolve();
        });
      } else {
        results.push({ file: document.title, result: {} });
        resolve();
      }
    });
  });

  await Promise.all(parsePromises);
  sendResponseIfComplete();
});

module.exports = {
  createDocument,
  getDocuments,
  getDocument,
  updateDocument,
  deleteDocument,
  uploadDocumentFiles,
  uploadFiles,
  parseDocuments,
};
