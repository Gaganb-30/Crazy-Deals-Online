// middlewares/uploadMiddleware.js
const multer = require("multer");
const path = require("path");

// Configure storage - use memory storage for Excel processing
const storage = multer.memoryStorage();

// File filter for Excel files only
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
    "application/octet-stream", // Some Excel files
  ];

  const fileExt = path.extname(file.originalname).toLowerCase();

  if (
    allowedMimeTypes.includes(file.mimetype) ||
    [".xlsx", ".xls"].includes(fileExt)
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only Excel files are allowed (.xlsx, .xls)"), false);
  }
};

const upload = multer({
  storage: storage, // Use memory storage for Excel buffer processing
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

module.exports = upload;
