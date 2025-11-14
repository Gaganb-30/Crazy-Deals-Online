const express = require("express");
const router = express.Router();
const {
  bulkImportBooks,
  getImportTemplate,
} = require("../controllers/bulkImportController");
const { authMiddleware, restrictTo } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");

// All routes require admin authentication
router.use(authMiddleware);
router.use(restrictTo(["ADMIN"]));

/**
 * @route   POST /api/bulk-import/books
 * @desc    Bulk import books from Excel file
 * @access  Private/Admin
 */
router.post("/books", upload.single("file"), bulkImportBooks);

/**
 * @route   GET /api/bulk-import/template
 * @desc    Download Excel template for bulk import
 * @access  Private/Admin
 */
router.get("/template", getImportTemplate);

module.exports = router;
