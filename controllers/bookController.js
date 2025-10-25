const Book = require("../models/Book");
const { authMiddleware, restrictTo } = require("../middlewares/authMiddleware");

// ========================
// 🎯 CONTROLLER FUNCTIONS
// ========================

/**
 * Get all books with filtering, pagination, and sorting
 */
const getAllBooks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = "createdAt",
      order = "desc",
      category,
      author,
      minPrice,
      maxPrice,
      available,
      featured,
      search,
    } = req.query;

    // Build filter object
    const filter = { available: true };

    if (category) filter.category = category;
    if (author) filter.author = new RegExp(author, "i");
    if (featured !== undefined) filter.featured = featured === "true";
    if (available !== undefined) filter.available = available === "true";

    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Text search
    if (search) {
      filter.$text = { $search: search };
    }

    // Pagination options
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sort]: order === "desc" ? -1 : 1 },
      select:
        "id title author price available format category images ratings stock",
    };

    // Execute query with pagination
    const books = await Book.paginate(filter, options);

    res.status(200).json({
      success: true,
      message: "Books retrieved successfully",
      data: {
        books: books.docs,
        pagination: {
          currentPage: books.page,
          totalPages: books.totalPages,
          totalBooks: books.totalDocs,
          hasNext: books.hasNextPage,
          hasPrev: books.hasPrevPage,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch books",
      error: error.message,
    });
  }
};

/**
 * Get single book by ID
 */
const getBookById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Book ID is required",
      });
    }

    const book = await Book.findById(id);

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    // Increment view count (you can add this field to your model)
    // await Book.findByIdAndUpdate(id, { $inc: { views: 1 } });

    res.status(200).json({
      success: true,
      message: "Book retrieved successfully",
      data: { book },
    });
  } catch (error) {
    console.error("Error fetching book:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to fetch book",
      error: error.message,
    });
  }
};

/**
 * Create new book (Admin only)
 */
// In controllers/booksController.js - update createBook function
const createBook = async (req, res) => {
  try {
    const {
      title,
      publisher,
      language,
      price,
      originalPrice,
      about,
      format,
      category,
      author,
      tags,
      images,
      stock,
      featured,
      // Book details
      isbn,
      pages,
      country,
      publicationDate,
      // dimensions,
      // weight
    } = req.body;

    // Validation
    if (!title || !publisher || !price || !category || !author) {
      return res.status(400).json({
        success: false,
        message:
          "Title, publisher, price, category, and author are required fields",
      });
    }

    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: "Price cannot be negative",
      });
    }

    if (stock && stock < 0) {
      return res.status(400).json({
        success: false,
        message: "Stock cannot be negative",
      });
    }

    // Check if ISBN already exists
    if (isbn) {
      const existingBook = await Book.findOne({ "details.isbn": isbn });
      if (existingBook) {
        return res.status(409).json({
          success: false,
          message: "A book with this ISBN already exists",
        });
      }
    }

    // Prepare book data
    const bookData = {
      title,
      publisher,
      language: language || "English", // Ensure language is set
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
      about,
      format: format || "Paperback",
      category,
      author,
      tags: tags || [],
      images: images || [],
      stock: stock ? parseInt(stock) : 0,
      featured: featured || false,
      details: {
        isbn,
        pages: pages ? parseInt(pages) : undefined,
        country: country || "India",
        publicationDate,
        // dimensions,
        // weight
      },
    };

    // Remove undefined fields from details
    Object.keys(bookData.details).forEach((key) => {
      if (bookData.details[key] === undefined) {
        delete bookData.details[key];
      }
    });

    const book = await Book.create(bookData);

    res.status(201).json({
      success: true,
      message: "Book created successfully",
      data: { book },
    });
  } catch (error) {
    console.error("Error creating book:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Book with this ISBN already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create book",
      error: error.message,
    });
  }
};

/**
 * Update book (Admin only)
 */
const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Book ID is required",
      });
    }

    // Find existing book
    const existingBook = await Book.findById(id);
    if (!existingBook) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    // Validate price if provided
    if (updateData.price && updateData.price < 0) {
      return res.status(400).json({
        success: false,
        message: "Price cannot be negative",
      });
    }

    // Validate stock if provided
    if (updateData.stock && updateData.stock < 0) {
      return res.status(400).json({
        success: false,
        message: "Stock cannot be negative",
      });
    }

    // Check ISBN uniqueness if provided
    if (updateData.isbn && updateData.isbn !== existingBook.details.isbn) {
      const bookWithISBN = await Book.findOne({
        "details.isbn": updateData.isbn,
        _id: { $ne: id },
      });

      if (bookWithISBN) {
        return res.status(409).json({
          success: false,
          message: "A book with this ISBN already exists",
        });
      }
    }

    // Handle nested details update
    if (updateData.isbn || updateData.pages || updateData.country) {
      updateData.details = {
        ...existingBook.details.toObject(),
        ...(updateData.isbn && { isbn: updateData.isbn }),
        ...(updateData.pages && { pages: parseInt(updateData.pages) }),
        ...(updateData.country && { country: updateData.country }),
      };

      // Remove the individual fields
      delete updateData.isbn;
      delete updateData.pages;
      delete updateData.country;
    }

    // Convert numeric fields
    if (updateData.price) updateData.price = parseFloat(updateData.price);
    if (updateData.originalPrice)
      updateData.originalPrice = parseFloat(updateData.originalPrice);
    if (updateData.stock) updateData.stock = parseInt(updateData.stock);

    const updatedBook = await Book.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "Book updated successfully",
      data: { book: updatedBook },
    });
  } catch (error) {
    console.error("Error updating book:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID format",
      });
    }

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update book",
      error: error.message,
    });
  }
};

/**
 * Delete book (Admin only)
 */
const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Book ID is required",
      });
    }

    const book = await Book.findById(id);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    // Check if book is in any active orders before deleting
    // You might want to soft delete instead
    await Book.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Book deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting book:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid book ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to delete book",
      error: error.message,
    });
  }
};

/**
 * Get books by category
 */
const getBooksByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    const books = await Book.paginate(
      { category, available: true },
      {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        select: "id title author price format images ratings",
      }
    );

    res.status(200).json({
      success: true,
      message: `Books in category '${category}' retrieved successfully`,
      data: {
        books: books.docs,
        pagination: {
          currentPage: books.page,
          totalPages: books.totalPages,
          totalBooks: books.totalDocs,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching books by category:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch books by category",
      error: error.message,
    });
  }
};

/**
 * Search books
 */
// In controllers/booksController.js - update searchBooks function
const searchBooks = async (req, res) => {
  try {
    const { q } = req.query;
    const { page = 1, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    // Use regex search instead of text search
    const searchRegex = new RegExp(q, "i");

    const books = await Book.paginate(
      {
        $or: [
          { title: searchRegex },
          { author: searchRegex },
          { category: searchRegex },
          { about: searchRegex },
        ],
        available: true,
      },
      {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { createdAt: -1 },
        select: "id title author price format category images ratings",
      }
    );

    res.status(200).json({
      success: true,
      message: `Search results for '${q}'`,
      data: {
        books: books.docs,
        pagination: {
          currentPage: books.page,
          totalPages: books.totalPages,
          totalBooks: books.totalDocs,
        },
      },
    });
  } catch (error) {
    console.error("Error searching books:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search books",
      error: error.message,
    });
  }
};

// ========================
// 📦 EXPORT CONTROLLERS
// ========================
module.exports = {
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  getBooksByCategory,
  searchBooks,
};
