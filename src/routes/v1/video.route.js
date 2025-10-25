const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const video = require('../../validations/video.validation');
const videoController = require('../../controllers/video.controller');
const roles = require('../../configs/roles');

const router = express.Router();

router
  .route('/')
  .post(auth(roles.accessCategories.video.manageVideo), validate(video.createVideo), videoController.createVideo)
  .get(auth(roles.accessCategories.video.getVideo), validate(video.getVideos), videoController.getVideos);

router
  .route('/:videoId')
  .get(auth(roles.accessCategories.video.getVideo), validate(video.getVideo), videoController.getVideo)
  .patch(auth(roles.accessCategories.video.manageVideo), validate(video.updateVideo), videoController.updateVideo)
  .delete(auth(roles.accessCategories.video.manageVideo), validate(video.deleteVideo), videoController.deleteVideo);

router.route('/upload_file').post(auth(roles.accessCategories.video.manageVideo), videoController.uploadFiles);
router.route('/upload_file/:supplierId').post(auth(roles.accessCategories.video.manageVideo), videoController.uploadFiles);

router.route('/parse').post(auth(roles.accessCategories.video.manageVideo), videoController.parseVideos);

module.exports = router;
