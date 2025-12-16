// models/Book.js
const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");
const bookDetailsSchema = require("./schemas/bookDetails");

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Book title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    publisher: {
      type: String,
      required: [true, "Publisher is required"],
      trim: true,
    },
    language: {
      type: String,
      required: [true, "Language is required"],
      default: "English",
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
      set: (v) => Math.round(v * 100) / 100, // Store with 2 decimal precision
    },
    originalPrice: {
      type: Number,
      min: [0, "Original price cannot be negative"],
    },
    available: {
      type: Boolean,
      default: true,
    },
    stock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },
    about: {
      type: String,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    format: {
      type: String,
      enum: ["Paperback", "Hardcover"],
      default: "Paperback",
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      index: true,
      lowercase: true,
      trim: true,
    },
    author: {
      type: String,
      required: [true, "Author is required"],
      trim: true,
    },
    tags: [String],
    images: [
      {
        url: String,
        alt: String,
        isPrimary: { type: Boolean, default: false },
      },
    ],
    details: bookDetailsSchema,
    ratings: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },
    featured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Remove or modify the text index that's causing the issue
// Instead of creating a text index with default language settings,
// create individual indexes for better control

// Compound indexes for better query performance
bookSchema.index({ category: 1, price: 1 });
bookSchema.index({ author: 1 });
bookSchema.index({ featured: -1, createdAt: -1 });
bookSchema.index({ title: 1 }); // Regular index for title
bookSchema.index({ available: 1, stock: 1 });

// If you need text search, create it with explicit language setting
// Use 'none' or 'english' instead of relying on document language
bookSchema.index(
  {
    title: "text",
    author: "text",
    about: "text",
    category: "text",
  },
  {
    name: "book_search_index",
    default_language: "english", // Explicitly set to english
    language_override: "none", // Don't use the language field
  }
);

// Virtual for discount percentage
bookSchema.virtual("discountPercentage").get(function () {
  if (!this.originalPrice || this.originalPrice <= this.price) return 0;
  return Math.round(
    ((this.originalPrice - this.price) / this.originalPrice) * 100
  );
});

// Static method to find books by category
bookSchema.statics.findByCategory = function (category) {
  return this.find({ category, available: true }).sort({ createdAt: -1 });
};

// Static method to find featured books
bookSchema.statics.findFeatured = function () {
  return this.find({ featured: true, available: true }).limit(10);
};

// Static method for text search (if needed)
bookSchema.statics.searchBooks = function (query) {
  return this.find(
    {
      $text: { $search: query },
      available: true,
    },
    { score: { $meta: "textScore" } }
  ).sort({ score: { $meta: "textScore" } });
};

bookSchema.statics.findFeatured = function (limit = 10) {
  return this.find({
    featured: true,
    available: true,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("id title author price originalPrice format images about");
};

// Instance method to update stock
bookSchema.methods.updateStock = function (quantity) {
  this.stock += quantity;
  if (this.stock <= 0) {
    this.available = false;
    this.stock = 0;
  } else {
    this.available = true;
  }
  return this.save();
};

bookSchema.methods.removeBook = async function () {
  try {
    const bookId = this._id;

    // Remove this book from all carts
    await this.model("Cart").updateMany(
      { "items.book": bookId },
      { $pull: { items: { book: bookId } } }
    );

    console.log(`Removed book ${bookId} from all carts`);
  } catch (error) {
    console.log(error);
  }
};

bookSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("Book", bookSchema);
