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

const uploadVideos = multer({ storage: fileStorage }).array('file', 100);

const createVideo = catchAsync(async (req, res) => {
  const reqBody = {
    ...req.body,
    addedBy: req.user._id,
  };
  const videoGroup = await videoService.createVideo(reqBody);
  res.status(httpStatus.CREATED).send(videoGroup);
});

const getVideos = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['name', 'path', 'group', 'addedBy', 'accessState']);
  const options = pick(req.query, ['sortBy', 'limit', 'page']);
  const result = await videoService.queryVideos(filter, options);
  res.send(result);
});

const getVideo = catchAsync(async (req, res) => {
  const user = await videoService.getVideoById(req.params.videoId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Video not found');
  }
  res.send(user);
});

const updateVideo = catchAsync(async (req, res) => {
  const user = await videoService.updateVideoById(req.params.videoId, req.body);
  res.send(user);
});

const deleteVideo = catchAsync(async (req, res) => {
  await videoService.deleteVideoById(req.params.videoId);
  res.status(httpStatus.NO_CONTENT).send();
});

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
                  const filePath = path.join(__dirname, '../..', 'uploads', file.filename); // file.filename is already a unique name
                  const fileUrl = `/api/uploads/${file.filename}`;
                  
                  // If the type is PDF, call the Python script for parsing
                  const type = mime.extension(file.mimetype);
                  console.log(`Attachment content type: ${type}`);
                  // if (type === 'application/pdf' || type === 'pdf') {
                  //   // Call the Python script for parsing
                  //   const pythonProcess = spawn('python', [path.join(__dirname, '../python/parse_files.py'), filePath]);

                  //   let pythonOutput = '';
                  //   pythonProcess.stdout.on('data', (data) => {
                  //       pythonOutput += data.toString();
                  //   });

                  //   pythonProcess.stderr.on('data', (data) => {
                  //       console.error(`stderr: ${data}`);
                  //   });

                  //   pythonProcess.on('close', async (code) => {
                  //       if (code === 0) {
                  //           const parsedData = JSON.parse(pythonOutput);
                  //           console.log(parsedData);
                  //           results.push({
                  //               file: file.filename,
                  //               result: parsedData,
                  //           });

                  //           // Store file information to the database
                  //           await videoService.createVideo({
                  //               title: file.originalname, // Keep the original filename
                  //               path: fileUrl,
                  //               group: req.body.group,
                  //               accessState: "private",
                  //               addedBy: req.user._id,
                  //               supplier: supplierId,
                  //               json: parsedData // If you want to store the parsed data
                  //           });

                  //           if (results.length === req.files.length) {
                  //               res.status(200).json({
                  //                   status: true,
                  //                   message: 'Files processed successfully',
                  //                   files: results,
                  //               });
                  //           }
                  //       } else {
                  //           res.status(500).send({ error: { message: 'Error processing file with Python script' } });
                  //       }
                  //   });
                  // } else {
                    const parsedData = {};
                    results.push({
                      file: file.filename,
                      result: parsedData,
                    });
                    // Store file information to the database
                    await videoService.createVideo({
                      title: file.originalname, // Keep the original filename
                      path: fileUrl,
                      group: req.body.group,
                      accessState: "private",
                      addedBy: req.user._id,
                      supplier: supplierId,
                      json: parsedData // If you want to store the parsed data
                    });
                    if (results.length === req.files.length) {
                      res.status(200).json({
                        status: true,
                        message: 'Files processed successfully',
                        files: results,
                      });
                    }
                  // }
              }
          } else {
              res.status(400).send({ message: 'No files uploaded' });
          }
      } catch (e) {
          console.error(e);
          res.status(500).send({ error: { message: 'Internal server error' } });
      }
  });
});

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
