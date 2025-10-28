// controllers/authController.js
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const axios = require("axios"); // For token verification

/**
 * Generate JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      role: user.role,
      authProvider: user.authProvider,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

/**
 * Google OAuth callback - Direct JWT approach
 */
const googleAuthCallback = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?error=authentication_failed`
      );
    }

    const token = generateToken(req.user);
    const user = req.user;

    // For API clients, return JSON
    if (req.query.format === "json") {
      return res.json({
        success: true,
        message: "Google authentication successful",
        data: {
          token,
          user: {
            id: user._id,
            email: user.email,
            name: user.name,
            role: user.role,
            profilePicture: user.profilePicture,
            authProvider: user.authProvider,
          },
        },
      });
    }

    // For web clients, redirect with token
    res.redirect(
      `${
        process.env.FRONTEND_URL
      }/oauth-success?token=${token}&user=${encodeURIComponent(
        JSON.stringify({
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          profilePicture: user.profilePicture,
          authProvider: user.authProvider,
        })
      )}`
    );
  } catch (error) {
    console.error("Google Auth Callback Error:", error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=server_error`);
  }
};

/**
 * Direct Google token verification (Alternative to Passport)
 */
const verifyGoogleToken = async (req, res) => {
  try {
    const { googleToken } = req.body;

    if (!googleToken) {
      return res.status(400).json({
        success: false,
        message: "Google token is required",
      });
    }

    // Verify Google token with Google API
    const googleResponse = await axios.get(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${googleToken}`
    );
    const profile = googleResponse.data;

    // Find or create user
    const user = await User.findOne({ googleId: profile.sub });
    if (!user) {
      // Create new user
      const newUser = await User.create({
        googleId: profile.sub,
        email: profile.email,
        name: profile.name,
        profilePicture: profile.picture,
        authProvider: "google",
        emailVerified: profile.email_verified === "true",
        phone: "Not provided",
        address: {
          street: "Not provided",
          city: "Not provided",
          state: "Not provided",
          zipCode: "000000",
          country: "India",
        },
      });

      const token = generateToken(newUser);

      return res.json({
        success: true,
        message: "Google authentication successful",
        data: {
          token,
          user: {
            id: newUser._id,
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
            profilePicture: newUser.profilePicture,
            authProvider: newUser.authProvider,
          },
        },
      });
    }

    // Existing user
    const token = generateToken(user);

    res.json({
      success: true,
      message: "Google authentication successful",
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          profilePicture: user.profilePicture,
          authProvider: user.authProvider,
        },
      },
    });
  } catch (error) {
    console.error("Verify Google Token Error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid Google token",
      error: error.message,
    });
  }
};

/**
 * Get current user from JWT
 */
const getCurrentUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User retrieved successfully",
      data: { user },
    });
  } catch (error) {
    console.error("Get Current User Error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid token",
      error: error.message,
    });
  }
};

/**
 * Link Google account to existing local account
 */
const linkGoogleAccount = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { googleToken } = req.body;

    if (!googleToken) {
      return res.status(400).json({
        success: false,
        message: "Google token is required",
      });
    }

    // Verify Google token
    const googleResponse = await axios.get(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${googleToken}`
    );
    const profile = googleResponse.data;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if Google account is already linked to another user
    const existingGoogleUser = await User.findOne({ googleId: profile.sub });
    if (existingGoogleUser && existingGoogleUser._id.toString() !== userId) {
      return res.status(400).json({
        success: false,
        message: "This Google account is already linked to another user",
      });
    }

    // Link accounts
    user.googleId = profile.sub;
    user.authProvider = "google";
    user.profilePicture = profile.picture;
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      message: "Google account linked successfully",
      data: {
        user,
        token, // Return new token with updated provider
      },
    });
  } catch (error) {
    console.error("Link Google Account Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to link Google account",
      error: error.message,
    });
  }
};

/**
 * Unlink Google account
 */
const unlinkGoogleAccount = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.authProvider !== "google") {
      return res.status(400).json({
        success: false,
        message: "Account is not linked with Google",
      });
    }

    // Check if user has local authentication setup
    if (!user.email) {
      return res.status(400).json({
        success: false,
        message: "Please set up email before unlinking Google account",
      });
    }

    // Unlink Google
    user.googleId = undefined;
    user.authProvider = "local";
    user.profilePicture = undefined;
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      message: "Google account unlinked successfully",
      data: {
        user,
        token, // Return new token
      },
    });
  } catch (error) {
    console.error("Unlink Google Account Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unlink Google account",
      error: error.message,
    });
  }
};

module.exports = {
  googleAuthCallback,
  verifyGoogleToken,
  getCurrentUser,
  linkGoogleAccount,
  unlinkGoogleAccount,
  generateToken,
};
