import express from "express";
import AuthController from "../controllers/authController.js";
import { auth } from "../middleware/auth.js";
import {
  validateRegistration,
  validateLogin,
} from "../middleware/validation.js";

const authRouter = express.Router();

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
authRouter.post("/register", validateRegistration, AuthController.register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
authRouter.post("/login", validateLogin, AuthController.login);

// @route   GET /api/auth/profile
// @desc    Get current user profile
// @access  Private
authRouter.get("/profile", auth, AuthController.getProfile);

// @route   PUT /api/auth/profile
// @desc    Update current user profile
// @access  Private
authRouter.put("/profile", auth, AuthController.updateProfile);

export default authRouter;
