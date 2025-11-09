// routes/contactRoutes.js
const express = require("express");
const router = express.Router();
const { sendContactEmail } = require("../controllers/contactController");

/**
 * @route   POST /api/contact
 * @desc    Send contact/support email
 * @access  Public
 * @body    {name, email, subject, message, phone}
 */
router.post("/", sendContactEmail);

module.exports = router;
