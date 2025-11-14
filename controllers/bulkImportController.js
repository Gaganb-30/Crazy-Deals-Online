const xlsx = require("xlsx");
const Book = require("../models/Book");
const path = require("path");
const fs = require("fs");

/**
 * Bulk import books from Excel file
 */
const bulkImportBooks = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an Excel file",
      });
    }

    // Read the Excel file
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data = xlsx.utils.sheet_to_json(worksheet);

    if (data.length === 0) {
      // Remove uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Excel file is empty",
      });
    }

    console.log(`Processing ${data.length} books...`);

    const results = {
      total: data.length,
      successful: 0,
      failed: 0,
      errors: [],
    };

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // +2 because Excel rows start at 1 and header is row 1

      try {
        // Validate required fields
        if (!row.title || !row.author || !row.price) {
          results.errors.push(
            `Row ${rowNumber}: Missing required fields (title, author, or price)`
          );
          results.failed++;
          continue;
        }

        // Prepare book data
        const bookData = {
          title: row.title.toString().trim(),
          author: row.author.toString().trim(),
          publisher: row.publisher
            ? row.publisher.toString().trim()
            : "Unknown Publisher",
          language: row.language ? row.language.toString().trim() : "English",
          price: parseFloat(row.price),
          originalPrice: row.originalPrice
            ? parseFloat(row.originalPrice)
            : parseFloat(row.price),
          about: row.about
            ? row.about.toString().trim()
            : `A book by ${row.author}`,
          format:
            row.format &&
            ["Paperback", "Hardcover"].includes(row.format.toUpperCase())
              ? row.format.toUpperCase()
              : "Paperback",
          category: row.category ? row.category.toString().trim() : "Fiction",
          stock: row.stock ? parseInt(row.stock) : 0,
          featured: row.featured
            ? row.featured.toString().toLowerCase() === "yes" ||
              row.featured === true
            : false,
          available: true,
          // Book details
          details: {
            isbn: row.isbn ? row.isbn.toString().trim() : "",
            pages: row.pages ? parseInt(row.pages) : 0,
            country: row.country ? row.country.toString().trim() : "India",
            publicationDate: row.publicationDate
              ? new Date(row.publicationDate)
              : null,
            weight: row.weight ? parseInt(row.weight) : 0,
          },
        };

        // Handle tags
        if (row.tags) {
          bookData.tags = row.tags
            .toString()
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag);
        }

        // Handle images
        if (row.images) {
          const imageUrls = row.images
            .toString()
            .split(",")
            .map((url) => url.trim())
            .filter((url) => url);
          bookData.images = imageUrls.map((url, index) => ({
            url: url,
            alt: `${row.title} - Image ${index + 1}`,
            isPrimary: index === 0,
          }));
        } else {
          // Default placeholder image
          bookData.images = [
            {
              url: "/placeholder-book.jpg",
              alt: `${row.title} - Cover Image`,
              isPrimary: true,
            },
          ];
        }

        // Validate price
        if (isNaN(bookData.price) || bookData.price < 0) {
          results.errors.push(`Row ${rowNumber}: Invalid price - ${row.price}`);
          results.failed++;
          continue;
        }

        // Validate stock
        if (isNaN(bookData.stock) || bookData.stock < 0) {
          results.errors.push(`Row ${rowNumber}: Invalid stock - ${row.stock}`);
          results.failed++;
          continue;
        }

        // Check if book already exists (by title and author)
        const existingBook = await Book.findOne({
          title: bookData.title,
          author: bookData.author,
        });

        if (existingBook) {
          results.errors.push(
            `Row ${rowNumber}: Book already exists - "${bookData.title}" by ${bookData.author}`
          );
          results.failed++;
          continue;
        }

        // Create the book
        const book = new Book(bookData);
        await book.save();
        results.successful++;

        console.log(`✅ Imported: ${bookData.title}`);
      } catch (error) {
        console.error(`Error processing row ${rowNumber}:`, error);
        results.errors.push(`Row ${rowNumber}: ${error.message}`);
        results.failed++;
      }
    }

    // Remove uploaded file
    fs.unlinkSync(req.file.path);

    // Prepare response
    const response = {
      success: true,
      message: `Bulk import completed. Success: ${results.successful}, Failed: ${results.failed}, Total: ${results.total}`,
      data: results,
    };

    // If all failed
    if (results.successful === 0 && results.failed > 0) {
      response.success = false;
      response.message =
        "All books failed to import. Please check the errors and try again.";
    }

    res.json(response);
  } catch (error) {
    console.error("Bulk import error:", error);

    // Remove uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: "Bulk import failed",
      error: error.message,
    });
  }
};

/**
 * Get import template
 */
const getImportTemplate = async (req, res) => {
  try {
    // Create sample data for template
    const sampleData = [
      {
        title: "The Great Gatsby",
        author: "F. Scott Fitzgerald",
        publisher: "Scribner",
        language: "English",
        price: 12.99,
        originalPrice: 15.99,
        about: "A classic novel about the American Dream",
        format: "Paperback",
        category: "Fiction",
        tags: "classic, american, fiction",
        stock: 50,
        featured: "Yes",
        isbn: "9780743273565",
        pages: 180,
        country: "India",
        publicationDate: "2023-01-15",
        weight: 300,
        images: "https://example.com/image1.jpg,https://example.com/image2.jpg",
      },
      {
        title: "To Kill a Mockingbird",
        author: "Harper Lee",
        publisher: "J.B. Lippincott & Co.",
        language: "English",
        price: 14.5,
        originalPrice: 16.99,
        about: "A novel about racial inequality and moral growth",
        format: "Hardcover",
        category: "Fiction",
        tags: "classic, social justice, fiction",
        stock: 30,
        featured: "No",
        isbn: "9780061120084",
        pages: 281,
        country: "India",
        publicationDate: "2023-02-20",
        weight: 450,
        images: "https://example.com/image3.jpg",
      },
    ];

    // Create workbook
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(sampleData);

    // Add worksheet to workbook
    xlsx.utils.book_append_sheet(workbook, worksheet, "Books Template");

    // Set response headers for file download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=book-import-template.xlsx"
    );

    // Generate buffer and send
    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.send(buffer);
  } catch (error) {
    console.error("Template download error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download template",
      error: error.message,
    });
  }
};

module.exports = {
  bulkImportBooks,
  getImportTemplate,
};
