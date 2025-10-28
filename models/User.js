// models/User.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const mongoosePaginate = require("mongoose-paginate-v2");
const dotenv = require("dotenv");

dotenv.config();

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: function () {
        return !this.googleId; // Email required only for local authentication
      },
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId; // Password required only for local authentication
      },
      minlength: [6, "Password must be at least 6 characters"],
    },
    name: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ["USER", "ADMIN"],
      default: "USER",
    },
    phone: {
      type: String,
      trim: true,
    },
    optionalPhone: {
      type: String,
      trim: true,
    },
    address: {
      hNo: {
        type: String,
      },
      street: {
        type: String,
      },
      city: {
        type: String,
      },
      state: {
        type: String,
      },
      zipCode: {
        type: String,
      },
      country: {
        type: String,
        default: "India",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Google OAuth fields
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
    },
    profilePicture: {
      type: String,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  }
);

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ authProvider: 1 });

// Password hashing middleware (only for local authentication)
userSchema.pre("save", async function (next) {
  // Only hash password if it's modified and user is using local auth
  if (!this.isModified("password") || this.authProvider !== "local")
    return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password + process.env.PEPPER, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method (only for local authentication)
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (this.authProvider !== "local") {
    throw new Error("This account uses Google authentication");
  }
  return bcrypt.compare(candidatePassword + process.env.PEPPER, this.password);
};

// Check if user is admin
userSchema.methods.isAdmin = function () {
  return this.role === "ADMIN";
};

// Check if user uses Google OAuth
userSchema.methods.isGoogleUser = function () {
  return this.authProvider === "google";
};

// Static method to find or create Google user
userSchema.statics.findOrCreateGoogleUser = async function (profile) {
  try {
    // Check if user already exists with this Google ID
    let user = await this.findOne({ googleId: profile.id });

    if (user) {
      return user;
    }

    // Check if user exists with the same email
    user = await this.findOne({ email: profile.emails[0].value });

    if (user) {
      // Link Google account to existing user
      user.googleId = profile.id;
      user.authProvider = "google";
      user.profilePicture = profile.photos[0].value;
      user.emailVerified = true;
      await user.save();
      return user;
    }

    // Create new user for Google OAuth
    user = await this.create({
      googleId: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      profilePicture: profile.photos[0].value,
      authProvider: "google",
      emailVerified: true,
      // Set default values for required fields
      phone: "Not provided",
      address: {
        hNo: "Not provided",
        street: "Not provided",
        city: "Not provided",
        state: "Not provided",
        zipCode: "000000",
        country: "India",
      },
    });

    return user;
  } catch (error) {
    throw error;
  }
};

userSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("User", userSchema);
