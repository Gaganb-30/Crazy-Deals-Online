// routes/bookRoutes.js
const express = require("express");
const router = express.Router();
const {
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  getBooksByCategory,
  searchBooks,
  getAllCategories,
  getFeaturedBooks,
} = require("../controllers/bookController");
const { authMiddleware, restrictTo } = require("../middlewares/authMiddleware");

// ========================
// 📚 PUBLIC ROUTES
// ========================

/**
 * @route   GET /api/books
 * @desc    Get all books with filtering, pagination, and sorting
 * @access  Public
 * @query   page, limit, sort, order, category, author, minPrice, maxPrice, available, featured, search
 */
router.get("/", getAllBooks);

/**
 * @route   GET /api/books/search
 * @desc    Search books by title, author, or description
 * @access  Public
 * @query   q (search query), page, limit
 */
router.get("/search", searchBooks);

/**
 * @route   GET /api/books/category/:category
 * @desc    Get books by category
 * @access  Public
 * @params  category
 * @query   page, limit
 */
router.get("/category/:category", getBooksByCategory);

/**
 * @route   GET /api/books/categories
 * @desc    Get all unique book categories
 * @access  Public
 */
router.get("/categories", getAllCategories); // Add this route

/**
 * @route   GET /api/books/:id
 * @desc    Get single book by ID
 * @access  Public
 * @params  id
 */
router.get("/:id", getBookById);

/**
 * @route   GET /api/books/featured
 * @desc    Get featured books
 * @access  Public
 * @query   page, limit
 */
router.get("/featured/books", getFeaturedBooks);

// ========================
// 🔐 PROTECTED ROUTES (Admin only)
// ========================

/**
 * @route   POST /api/books
 * @desc    Create new book
 * @access  Private/Admin
 */
router.post("/", authMiddleware, restrictTo(["ADMIN"]), createBook);

/**
 * @route   PUT /api/books/:id
 * @desc    Update book
 * @access  Private/Admin
 * @params  id
 */
router.put("/:id", authMiddleware, restrictTo(["ADMIN"]), updateBook);

/**
 * @route   DELETE /api/books/:id
 * @desc    Delete book
 * @access  Private/Admin
 * @params  id
 */
router.delete("/:id", authMiddleware, restrictTo(["ADMIN"]), deleteBook);

module.exports = router;
