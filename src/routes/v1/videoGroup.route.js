const express = require('express');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const videoGroupValidation = require('../../validations/videoGroup.validation');
const videoGroupController = require('../../controllers/videoGroup.controller');
const roles = require('../../configs/roles');

const router = express.Router();

router
  .route('/')
  .post(
    auth(roles.accessCategories.videoGroup.manageVideoGroups),
    validate(videoGroupValidation.createVideoGroup),
    videoGroupController.createVideoGroup
  )
  .get(
    auth(roles.accessCategories.videoGroup.getVideoGroups),
    validate(videoGroupValidation.getVideoGroups),
    videoGroupController.getVideoGroups
  );

router
  .route('/:groupId')
  .get(
    auth(roles.accessCategories.videoGroup.getVideoGroups),
    validate(videoGroupValidation.getVideoGroup),
    videoGroupController.getVideoGroup
  )
  .patch(
    auth(roles.accessCategories.videoGroup.manageVideoGroups),
    validate(videoGroupValidation.updateVideoGroup),
    videoGroupController.updateVideoGroup
  )
  .delete(
    auth(roles.accessCategories.videoGroup.manageVideoGroups),
    validate(videoGroupValidation.deleteVideoGroup),
    videoGroupController.deleteVideoGroup
  );

module.exports = router;

/**
 * @swagger
 * tags:
 *   name: VideoGroup
 *   description: VideoGroup management and retrieval
 */

/**
 * @swagger
 * /video-groups:
 *   post:
 *     summary: Create a videoGroup
 *     description: Only admins can create other video-groups.
 *     tags: [VideoGroup]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - groupName
 *             properties:
 *               groupName:
 *                 type: string
 *                 description: must be unique
 *               accessState:
 *                  type: string
 *                  enum: ['private', 'public', 'code_access']
 *     responses:
 *       "201":
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/VideoGroup'
 *       "400":
 *         $ref: '#/components/responses/DuplicateEmail'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *
 *   get:
 *     summary: Get all video-groups
 *     description: Only admins can retrieve all video-groups.
 *     tags: [VideoGroup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: groupName
 *         schema:
 *           type: string
 *         description: VideoGroup name
 *       - in: query
 *         name: accessState
 *         schema:
 *           type: string
 *         description: VideoGroup accessState
 *       - in: query
 *         name: addedBy
 *         schema:
 *           type: ObjectId
 *         description: UserId
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/VideoGroup'
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 limit:
 *                   type: integer
 *                   example: 10
 *                 totalPages:
 *                   type: integer
 *                   example: 1
 *                 totalResults:
 *                   type: integer
 *                   example: 1
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /video-groups/{id}:
 *   get:
 *     summary: Get a videoGroup
 *     description: Logged in user can fetch only their own create video groups information. Only admins can fetch other video-groups.
 *     tags: [VideoGroup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: VideoGroup id
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/VideoGroup'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   patch:
 *     summary: Update a user
 *     description: Logged in users can only update their own information. Only admins can update other video-groups.
 *     tags: [VideoGroup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: VideoGroup id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               groupName:
 *                 type: string
 *                 description: must be unique
 *               accessState:
 *                 type: string
 *                 enum: ['private', 'public', 'code_access']
 *     responses:
 *       "200":
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *                $ref: '#/components/schemas/VideoGroup'
 *       "400":
 *         $ref: '#/components/responses/DuplicateEmail'
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 *
 *   delete:
 *     summary: Delete a user
 *     description: Logged in users can delete only their created video groups. Only admins can delete other video groups.
 *     tags: [VideoGroup]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: VideoGroup id
 *     responses:
 *       "200":
 *         description: No content
 *       "401":
 *         $ref: '#/components/responses/Unauthorized'
 *       "403":
 *         $ref: '#/components/responses/Forbidden'
 *       "404":
 *         $ref: '#/components/responses/NotFound'
 */
