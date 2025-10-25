// schemas/BookDetails.js
const mongoose = require("mongoose");

const bookDetailsSchema = new mongoose.Schema(
  {
    isbn: {
      type: String,
      required: [true, "ISBN is required"],
      unique: true,
      trim: true,
    },
    pages: {
      type: Number,
      required: [true, "Number of pages is required"],
      min: [1, "Pages must be at least 1"],
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      default: "India",
    },
    publicationDate: {
      type: Date,
    },
    // dimensions: {
    //   height: Number,
    //   width: Number,
    //   depth: Number,
    // },
    // weight: {
    //   type: Number, // in grams
    //   min: [1, "Weight must be positive"],
    // },
  },
  {
    _id: false, // Since it's embedded, we don't need separate _id
  }
);

module.exports = bookDetailsSchema;
