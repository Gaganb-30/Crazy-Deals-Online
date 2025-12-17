// controllers/bookController.js
const Book = require("../models/Book");
const Fuse = require("fuse.js");
const XLSX = require("xlsx");

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

    // Text search - using regex for basic search in getAllBooks
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { author: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination options
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sort]: order === "desc" ? -1 : 1 },
      select:
        "id title author price originalPrice available format category images ratings stock",
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
 * Get featured books
 */
const getFeaturedBooks = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      select:
        "id title author price originalPrice available images featured about",
    };

    const books = await Book.paginate(
      {
        featured: true,
        available: true,
      },
      options
    );

    res.status(200).json({
      success: true,
      message: "Featured books retrieved successfully",
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
    console.error("Error fetching featured books:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch featured books",
      error: error.message,
    });
  }
};

/**
 * Get hindi books
 */
const getHindiBooks = async (req, res) => {
  try {
    const { page = 1, limit = 18 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      select:
        "id title author price originalPrice stock available images featured about",
    };

    const books = await Book.paginate(
      {
        language: "Hindi",
        available: true,
      },
      options
    );

    res.status(200).json({
      success: true,
      message: "Hindi books retrieved successfully",
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
    console.error("Error fetching hindi books:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch hindi books",
      error: error.message,
    });
  }
};

/**
 * Get featured books
 */
const getEnglishBooks = async (req, res) => {
  try {
    const { page = 1, limit = 18 } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      select:
        "id title author price originalPrice stock available images featured about",
    };

    const books = await Book.paginate(
      {
        language: "English",
        available: true,
      },
      options
    );

    res.status(200).json({
      success: true,
      message: "English books retrieved successfully",
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
    console.error("Error fetching english books:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch english books",
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
      weight,
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
      language: language || "English",
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
        weight,
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

    // Validate stock if provided
    if (updateData.weight && updateData.weight < 0) {
      return res.status(400).json({
        success: false,
        message: "Weight cannot be negative",
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
    if (
      updateData.isbn ||
      updateData.pages ||
      updateData.country ||
      updateData.weight
    ) {
      updateData.details = {
        ...existingBook.details.toObject(),
        ...(updateData.isbn && { isbn: updateData.isbn }),
        ...(updateData.pages && { pages: parseInt(updateData.pages) }),
        ...(updateData.country && { country: updateData.country }),
        ...(updateData.weight && { weight: updateData.weight }),
      };

      // Remove the individual fields
      delete updateData.isbn;
      delete updateData.pages;
      delete updateData.country;
      delete updateData.weight;
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

    const book = await Book.findByIdAndDelete(id);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    // This will trigger the pre-remove hook
    await book.removeBook();

    res.status(200).json({
      success: true,
      message:
        "Book deleted successfully and automatically removed from all carts",
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
        select:
          "id title author price originalPrice format images ratings stock",
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
 * Get all unique book categories
 */
const getAllCategories = async (req, res) => {
  try {
    // Get distinct categories from available books
    const categories = await Book.distinct("category", { available: true });

    if (!categories || categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No categories found",
      });
    }

    // Sort categories alphabetically
    const sortedCategories = categories.sort();

    // Optional: Get count of books in each category
    const categoriesWithCounts = await Book.aggregate([
      { $match: { available: true } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          // Get sample book for each category (optional)
          sampleBook: { $first: "$title" },
        },
      },
      {
        $project: {
          category: "$_id",
          count: 1,
          sampleBook: 1,
          _id: 0,
        },
      },
      { $sort: { category: 1 } },
    ]);

    res.status(200).json({
      success: true,
      message: "Categories retrieved successfully",
      data: {
        categories: sortedCategories,
        // Include counts if needed
        categoriesWithCounts: categoriesWithCounts,
        totalCategories: categories.length,
      },
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
      error: error.message,
    });
  }
};

/**
 * Advanced search using Fuse.js for fuzzy search
 */

/**
 * Enhanced search with ISBN support
 */
const searchBooks = async (req, res) => {
  try {
    const { q, page = 1, limit = 10, searchType = "all" } = req.query;

    if (!q || q.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    // Get all available books for Fuse.js search
    const allBooks = await Book.find(
      { available: true },
      "id title author stock price originalPrice format category images ratings about tags details.isbn"
    ).lean();

    if (allBooks.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No books available",
        data: {
          books: [],
          pagination: {
            currentPage: 1,
            totalPages: 0,
            totalBooks: 0,
          },
        },
      });
    }

    // Configure Fuse.js options based on search type
    let fuseOptions;

    switch (searchType) {
      case "title":
        fuseOptions = {
          keys: [{ name: "title", weight: 1 }],
          includeScore: true,
          threshold: 0.4,
          distance: 100,
          minMatchCharLength: 2,
          shouldSort: true,
        };
        break;
      case "author":
        fuseOptions = {
          keys: [{ name: "author", weight: 1 }],
          includeScore: true,
          threshold: 0.4,
          distance: 100,
          minMatchCharLength: 2,
          shouldSort: true,
        };
        break;
      case "isbn":
        fuseOptions = {
          keys: [{ name: "details.isbn", weight: 1 }],
          includeScore: true,
          threshold: 0.3, // Lower threshold for exact ISBN matching
          distance: 50,
          minMatchCharLength: 1, // Allow partial ISBN matches
          shouldSort: true,
        };
        break;
      default:
        // Search in all fields
        fuseOptions = {
          keys: [
            { name: "title", weight: 0.5 },
            { name: "author", weight: 0.3 },
            { name: "details.isbn", weight: 0.1 },
            { name: "category", weight: 0.05 },
            { name: "tags", weight: 0.05 },
          ],
          includeScore: true,
          threshold: 0.4,
          distance: 100,
          minMatchCharLength: 2,
          shouldSort: true,
        };
    }

    // Create Fuse instance
    const fuse = new Fuse(allBooks, fuseOptions);

    // Perform search
    const searchResults = fuse.search(q);

    // Extract books from search results
    let books = searchResults.map((result) => ({
      ...result.item,
      relevanceScore: result.score,
    }));

    // Manual pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedBooks = books.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      message: `Search results for '${q}'`,
      data: {
        books: paginatedBooks,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(books.length / limit),
          totalBooks: books.length,
          hasNext: endIndex < books.length,
          hasPrev: startIndex > 0,
        },
        searchMeta: {
          query: q,
          searchType: searchType,
          totalMatches: books.length,
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

/**
 * Alternative: Hybrid search with MongoDB + Fuse.js
 * For better performance with large datasets
 */
const hybridSearchBooks = async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q || q.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    // First, use MongoDB regex for initial filtering (more efficient)
    const initialResults = await Book.find(
      {
        available: true,
        $or: [
          { title: { $regex: q, $options: "i" } },
          { author: { $regex: q, $options: "i" } },
        ],
      },
      "id title author price originalPrice format category images ratings about tags"
    ).lean();

    // Then use Fuse.js for fuzzy matching and ranking
    const fuseOptions = {
      keys: [
        { name: "title", weight: 0.7 },
        { name: "author", weight: 0.3 },
      ],
      includeScore: true,
      threshold: 0.5,
      shouldSort: true,
    };

    const fuse = new Fuse(initialResults, fuseOptions);
    const searchResults = fuse.search(q);

    let books = searchResults.map((result) => result.item);

    // Manual pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedBooks = books.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      message: `Search results for '${q}'`,
      data: {
        books: paginatedBooks,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(books.length / limit),
          totalBooks: books.length,
          hasNext: endIndex < books.length,
          hasPrev: startIndex > 0,
        },
      },
    });
  } catch (error) {
    console.error("Error in hybrid book search:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search books",
      error: error.message,
    });
  }
};

/**
 * Export books to Excel
 */
const exportBooksToExcel = async (req, res) => {
  try {
    const books = await Book.find({}).lean();

    // Transform data for Excel
    const excelData = books.map((book) => ({
      _id: book._id.toString(),
      title: book.title,
      publisher: book.publisher,
      language: book.language,
      price: book.price,
      originalPrice: book.originalPrice,
      available: book.available,
      stock: book.stock,
      about: book.about,
      format: book.format,
      category: book.category,
      author: book.author,
      tags: book.tags ? book.tags.join("|") : "",
      featured: book.featured,
      // Book details
      isbn: book.details?.isbn,
      pages: book.details?.pages,
      country: book.details?.country,
      publicationDate: book.details?.publicationDate
        ? new Date(book.details.publicationDate).toISOString().split("T")[0]
        : "",
      weight: book.details?.weight,
      // Images (primary image URL)
      image_url:
        book.images?.find((img) => img.isPrimary)?.url ||
        book.images?.[0]?.url ||
        "",
    }));

    // Create a new workbook
    const wb = XLSX.utils.book_new();

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, "Books");

    // Generate buffer
    const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=books_export.xlsx"
    );
    res.send(excelBuffer);
  } catch (error) {
    console.error("Export Excel Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export books to Excel",
      error: error.message,
    });
  }
};

/**
 * Download Excel template
 */
const downloadExcelTemplate = async (req, res) => {
  try {
    const templateData = [
      {
        _id: "OPTIONAL - Leave empty for new books",
        title: "Book Title (Required)",
        publisher: "Publisher Name (Required)",
        language: "English",
        price: "499.00",
        originalPrice: "699.00",
        available: "true",
        stock: "50",
        about: "Book description...",
        format: "Paperback",
        category: "fiction",
        author: "Author Name (Required)",
        tags: "tag1|tag2|tag3",
        featured: "false",
        isbn: "9781234567890",
        pages: "320",
        country: "India",
        publicationDate: "2024-01-15",
        weight: "450",
        image_url: "https://example.com/book-image.jpg",
      },
    ];

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Add some formatting (column widths)
    const wscols = [
      { wch: 25 }, // _id
      { wch: 40 }, // title
      { wch: 30 }, // publisher
      { wch: 15 }, // language
      { wch: 15 }, // price
      { wch: 15 }, // originalPrice
      { wch: 10 }, // available
      { wch: 10 }, // stock
      { wch: 50 }, // about
      { wch: 15 }, // format
      { wch: 20 }, // category
      { wch: 25 }, // author
      { wch: 30 }, // tags
      { wch: 10 }, // featured
      { wch: 20 }, // isbn
      { wch: 10 }, // pages
      { wch: 15 }, // country
      { wch: 15 }, // publicationDate
      { wch: 10 }, // weight
      { wch: 40 }, // image_url
    ];

    ws["!cols"] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, "Template");

    const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=books_template.xlsx"
    );
    res.send(excelBuffer);
  } catch (error) {
    console.error("Download Template Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download template",
      error: error.message,
    });
  }
};

/**
 * Import books from Excel
 */
const importBooksFromExcel = async (req, res) => {
  console.log("Import Excel Request Received");
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "No Excel file uploaded",
      });
    }

    // Read Excel file from buffer
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rows = XLSX.utils.sheet_to_json(worksheet);

    const results = [];
    const errors = [];
    let processed = 0;

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      try {
        const rowData = rows[i];

        // Skip empty rows
        if (!rowData.title && !rowData.author) {
          continue;
        }

        // Validate required fields
        if (!rowData.title || !rowData.publisher || !rowData.author) {
          errors.push(
            `Row ${i + 2}: Missing required fields (title, publisher, author)`
          );
          continue;
        }

        // Prepare book data
        const bookData = {
          title: String(rowData.title).trim(),
          publisher: String(rowData.publisher).trim(),
          language: rowData.language
            ? String(rowData.language).trim()
            : "English",
          price: parseFloat(rowData.price) || 0,
          originalPrice:
            parseFloat(rowData.originalPrice) || parseFloat(rowData.price) || 0,
          available:
            rowData.available !== undefined
              ? String(rowData.available).toLowerCase() === "true"
              : true,
          stock: parseInt(rowData.stock) || 0,
          about: rowData.about ? String(rowData.about).trim() : "",
          format: ["Paperback", "Hardcover"].includes(rowData.format)
            ? rowData.format
            : "Paperback",
          category: rowData.category
            ? String(rowData.category).trim().toLowerCase()
            : "general",
          author: String(rowData.author).trim(),
          tags: rowData.tags
            ? String(rowData.tags)
                .split("|")
                .map((tag) => tag.trim())
                .filter((tag) => tag)
            : [],
          featured:
            rowData.featured !== undefined
              ? String(rowData.featured).toLowerCase() === "true"
              : false,
          details: {
            isbn: rowData.isbn
              ? String(rowData.isbn).trim()
              : `TEMP-${Date.now()}-${i}`,
            pages: parseInt(rowData.pages) || 0,
            country: rowData.country ? String(rowData.country).trim() : "India",
            publicationDate: rowData.publicationDate
              ? new Date(rowData.publicationDate)
              : null,
            weight: parseInt(rowData.weight) || 300,
          },
          images: rowData.image_url
            ? [
                {
                  url: String(rowData.image_url).trim(),
                  alt: String(rowData.title).trim(),
                  isPrimary: true,
                },
              ]
            : [],
        };

        let result;

        // Update existing book or create new one
        if (rowData._id && String(rowData._id).trim()) {
          // Update existing book
          result = await Book.findByIdAndUpdate(
            String(rowData._id).trim(),
            bookData,
            {
              new: true,
              runValidators: true,
            }
          );
          if (!result) {
            errors.push(`Row ${i + 2}: Book with ID ${rowData._id} not found`);
            continue;
          }
          results.push({ action: "updated", book: result, row: i + 2 });
        } else {
          // Check if ISBN already exists
          if (rowData.isbn) {
            const existingBook = await Book.findOne({
              "details.isbn": String(rowData.isbn).trim(),
            });
            if (existingBook) {
              errors.push(`Row ${i + 2}: ISBN ${rowData.isbn} already exists`);
              continue;
            }
          }

          // Create new book
          result = await Book.create(bookData);
          results.push({ action: "created", book: result, row: i + 2 });
        }

        processed++;
      } catch (error) {
        errors.push(`Row ${i + 2}: ${error.message}`);
      }
    }

    res.status(200).json({
      success: true,
      message: `Processed ${processed} books successfully`,
      data: {
        processed,
        totalRows: rows.length,
        results: results.slice(0, 10), // Return first 10 results
        errors: errors.length > 0 ? errors : undefined,
        summary: {
          created: results.filter((r) => r.action === "created").length,
          updated: results.filter((r) => r.action === "updated").length,
          failed: errors.length,
        },
      },
    });
  } catch (error) {
    console.error("Import Excel Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to import books from Excel",
      error: error.message,
    });
  }
};

// ========================
// 📦 EXPORT CONTROLLERS
// ========================
module.exports = {
  getAllBooks,
  getFeaturedBooks,
  getHindiBooks,
  getEnglishBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  getBooksByCategory,
  searchBooks, // Using Fuse.js for fuzzy search
  hybridSearchBooks, // Optional: hybrid approach
  getAllCategories,
  exportBooksToExcel,
  downloadExcelTemplate,
  importBooksFromExcel,
};
