import express from "express";
import UserController from "../controllers/userController.js";
import { auth } from "../middleware/auth.js";
import { validatePagination } from "../middleware/validation.js";

const userRouter = express.Router();

// @route   GET /api/users
// @desc    Get all users
// @access  Private
userRouter.get("/", auth, validatePagination, UserController.getAllUsers);

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
userRouter.get("/:id", auth, UserController.getUserById);

// @route   GET /api/users/:id/posts
// @desc    Get user's posts
// @access  Private
userRouter.get(
  "/:id/posts",
  auth,
  validatePagination,
  UserController.getUserPosts
);

// @route   DELETE /api/users/:id
// @desc    Delete user (admin only)
// @access  Private
userRouter.delete("/:id", auth, UserController.deleteUser);

export default userRouter;
