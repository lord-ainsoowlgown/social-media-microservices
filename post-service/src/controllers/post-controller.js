const logger = require('../utils/logger');
const Post = require('../models/Post');
const { validateCreatePost } = require('../utils/validation');
const { publishEvent } = require('../utils/rabbitmq');

async function inavlidatePostCache(req, input) {
    const cacheKey = `post:${input}`;
    await req.redisClient.del(cacheKey);
    logger.info(`Invalidated cache for key: ${cacheKey}`);
    
    const keys = await req.redisClient.keys('posts*');
    if (keys.length > 0) {
        await req.redisClient.del(keys);
        logger.info('Invalidated post cache');
    }
};

const createPost = async (req, res) => {
    logger.info('Creating post endpoint hit...');
    try {
        // validate the schema
        const { error } = validateCreatePost(req.body);
        if (error) {
            logger.warn(`Validation error: ${error.details[0].message}`);
            return res.status(400).json({ 
                success: false,
                message: error.details[0].message 
            });
        }       

        const { content, mediaIds } = req.body;
        const newlyCreatedPost = new Post({
            user: req.user.userId,
            content,
            mediaIds: mediaIds || []
        });

        await newlyCreatedPost.save();

        await publishEvent("post.created", {
            postId: newlyCreatedPost._id.toString(),
            userId: newlyCreatedPost.user.toString(),
            content: newlyCreatedPost.content,
            createdAt: newlyCreatedPost.createdAt,
        });

        await inavlidatePostCache(req, newlyCreatedPost._id.toString());
        logger.info('Post created successfully', newlyCreatedPost);
        res.status(201).json({
            success: true,
            message: 'Post created successfully',
        });
    } catch (error) {
        logger.error('Error creating post', error);
        res.status(500).json({ 
            success: false,
            message: 'Error creating post' 
        });
    }
}

const getAllPost = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const startIndex = (page - 1) * limit;

        const cacheKey = `posts:${page}:${limit}`;
        const cachedPosts = await req.redisClient.get(cacheKey);
        if (cachedPosts) {
            logger.info('Serving posts from cache');
            return res.status(200).json({
                success: true,
                data: JSON.parse(cachedPosts)
            });
        }

        const posts = await Post.find()
            .sort({ createdAt: -1 })
            .skip(startIndex)
            .limit(limit);

        const totalNoOfPosts = await Post.countDocuments();

        const result = {
            posts,
            currentpage: page,
            totalPages: Math.ceil(totalNoOfPosts / limit),
            totalPosts: totalNoOfPosts
        }

        // Save your post in redis cache
        await req.redisClient.setex(cacheKey, 300, JSON.stringify(result));
        
        res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        logger.error('Error fetching post', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching post' 
        });
    }
}

const getSinglePost = async (req, res) => {
    try {
        const postId = req.params.postId;
        const cacheKey = `post:${postId}`;
        const cachedPost = await req.redisClient.get(cacheKey);
        if (cachedPost) {
            logger.info('Serving single post from cache');
            return res.status(200).json({
                success: true,
                data: JSON.parse(cachedPost)
            });
        }

        const post = await Post.findById(postId);
        if (!post) {
            logger.warn('Post not found');
            return res.status(404).json({ 
                success: false,
                message: 'Post not found' 
            });
        }

        // Save your post in redis cache
        await req.redisClient.setex(cacheKey, 3600, JSON.stringify(post));

        res.status(200).json({
            success: true,
            data: post
        });
    } catch (error) {
        logger.error('Error fetching post', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching post' 
        });
    }
}

const deletePost = async (req, res) => {
    try {
        const post = await Post.findOneAndDelete({
            _id: req.params.id,
            user: req.user.userId,
        });
        if (!post) {
            logger.warn('Post not found for deletion');
            return res.status(404).json({ 
                success: false,
                message: 'Post not found' 
            });
        }

        // Publish Post delete method ->
        await publishEvent ('post.deleted', { 
            postId: post._id.toString(),
            userId: req.user.userId,
            mediaIds: post.mediaIds
        });

        await inavlidatePostCache(req, postId);
        await Post.deleteOne({ _id: postId });
        logger.info('Post deleted successfully', postId);
        res.status(200).json({
            success: true,
            message: 'Post deleted successfully',
        });
    } catch (error) {
        logger.error('Error deleting post', error);
        res.status(500).json({ 
            success: false,
            message: 'Error deleting post' 
        });
    }
}

module.exports = {
    createPost,
    getAllPost,
    getSinglePost,
    deletePost
};