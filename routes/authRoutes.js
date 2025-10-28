// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const passport = require("../OAuth/passport");
const {
  googleAuthCallback,
  verifyGoogleToken,
  getCurrentUser,
  linkGoogleAccount,
  unlinkGoogleAccount,
} = require("../controllers/authController");
const { authMiddleware } = require("../middlewares/authMiddleware");

// ========================
// 🔐 GOOGLE OAUTH ROUTES
// ========================

/**
 * @route   GET /api/auth/google
 * @desc    Initiate Google OAuth (Server-side flow)
 * @access  Public
 */
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false, // Disable sessions
  })
);

/**
 * @route   GET /api/auth/google/callback
 * @desc    Google OAuth callback (Server-side flow)
 * @access  Public
 */
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`,
    session: false, // Disable sessions
  }),
  googleAuthCallback
);

/**
 * @route   POST /api/auth/google/token
 * @desc    Verify Google token (Client-side flow - Recommended)
 * @access  Public
 */
router.post("/google/token", verifyGoogleToken);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user from JWT
 * @access  Private
 */
router.get("/me", authMiddleware, getCurrentUser);

/**
 * @route   POST /api/auth/link-google
 * @desc    Link Google account to existing local account
 * @access  Private
 */
router.post("/link-google", authMiddleware, linkGoogleAccount);

/**
 * @route   POST /api/auth/unlink-google
 * @desc    Unlink Google account
 * @access  Private
 */
router.post("/unlink-google", authMiddleware, unlinkGoogleAccount);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (JWT - client should remove token)
 * @access  Private
 */
router.post("/logout", authMiddleware, (req, res) => {
  // With JWT, logout is handled client-side by removing the token
  res.json({
    success: true,
    message:
      "Logged out successfully. Please remove the token from client storage.",
  });
});

module.exports = router;
