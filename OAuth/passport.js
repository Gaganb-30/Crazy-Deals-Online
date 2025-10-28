// config/passport.js
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");
const dotenv = require("dotenv");

dotenv.config();

// Check if Google OAuth environment variables are set
const isGoogleOAuthConfigured =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

if (isGoogleOAuthConfigured) {
  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        passReqToCallback: true,
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const user = await User.findOrCreateGoogleUser(profile);
          return done(null, user);
        } catch (error) {
          console.error("Google OAuth Error:", error);
          return done(error, null);
        }
      }
    )
  );

  console.log("Google OAuth strategy configured successfully");
} else {
  console.warn(
    "Google OAuth environment variables not set. Google OAuth will be disabled."
  );
}

module.exports = passport;
