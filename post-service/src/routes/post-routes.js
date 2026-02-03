const express = require('express');
const { createPost, getAllPost, getSinglePost, deletePost } = require('../controllers/post-controller');
const { authenticateRequest } = require('../middleware/authMiddleware');

const router = express.Router();

// Middleware -> this will tell if the user is an auth user or not
router.use(authenticateRequest);

router.post('/create-post', createPost);
router.get('/get-posts', getAllPost);
router.get('/get-posts/:postId', getSinglePost);
router.delete('/delete-post/:postId', deletePost);

module.exports = router;