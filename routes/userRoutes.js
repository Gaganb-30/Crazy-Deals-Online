const express = require("express");
const router = express.Router();
const {
  signup,
  login,
  getProfile,
  updateProfile,
  changePassword,
  getAllUsers,
  updateUserRole,
  deleteUser,
} = require("../controllers/userController");
const { authMiddleware, restrictTo } = require("../middlewares/authMiddleware");

// ========================
// 🔓 PUBLIC ROUTES
// ========================

/**
 * @route   POST /api/users/signup
 * @desc    Register a new user
 * @access  Public
 * @body    {email, password, name, phone, address}
 */
router.post("/signup", signup);

/**
 * @route   POST /api/users/login
 * @desc    Login user and return JWT token
 * @access  Public
 * @body    {email, password}
 */
router.post("/login", login);

// ========================
// 🔐 PROTECTED ROUTES (Authenticated users)
// ========================

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get("/profile", authMiddleware, getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update current user profile
 * @access  Private
 * @body    {name, phone, address}
 */
router.put("/profile", authMiddleware, updateProfile);

/**
 * @route   PUT /api/users/change-password
 * @desc    Change current user password
 * @access  Private
 * @body    {currentPassword, newPassword}
 */
router.put("/change-password", authMiddleware, changePassword);

// ========================
// 🛡️ ADMIN ROUTES (Admin only)
// ========================

/**
 * @route   GET /api/users
 * @desc    Get all users (Admin only)
 * @access  Private/Admin
 * @query   page, limit, role, search
 */
router.get("/", authMiddleware, restrictTo(["ADMIN"]), getAllUsers);

/**
 * @route   PUT /api/users/:userId/role
 * @desc    Update user role (Admin only)
 * @access  Private/Admin
 * @params  userId
 * @body    {role}
 */
router.put(
  "/:userId/role",
  authMiddleware,
  restrictTo(["ADMIN"]),
  updateUserRole
);

/**
 * @route   DELETE /api/users/:userId
 * @desc    Delete user (Admin only)
 * @access  Private/Admin
 * @params  userId
 */
router.delete("/:userId", authMiddleware, restrictTo(["ADMIN"]), deleteUser);

module.exports = router;
