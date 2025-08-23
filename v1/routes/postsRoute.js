import express from "express";
import PostController from "../controllers/postController.js";
import { auth, optionalAuth } from "../middleware/auth.js";
import { validatePost, validatePagination } from "../middleware/validation.js";

const postRouter = express.Router();

// @route   POST /api/posts
// @desc    Create new post
// @access  Private
postRouter.post("/", auth, validatePost, PostController.createPost);

// @route   GET /api/posts
// @desc    Get all posts with filters
// @access  Public
postRouter.get(
  "/",
  optionalAuth,
  validatePagination,
  PostController.getAllPosts
);

// @route   GET /api/posts/:id
// @desc    Get post by ID
// @access  Public
postRouter.get("/:id", optionalAuth, PostController.getPostById);

// @route   PUT /api/posts/:id
// @desc    Update post
// @access  Private
postRouter.put("/:id", auth, validatePost, PostController.updatePost);

// @route   DELETE /api/posts/:id
// @desc    Delete post
// @access  Private
postRouter.delete("/:id", auth, PostController.deletePost);

export default postRouter;
