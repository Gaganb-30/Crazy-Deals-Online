// app.js
const express = require("express");
const app = express();
const cors = require("cors");
const userRoutes = require("./routes/userRoutes");
const bookRoutes = require("./routes/bookRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
const passport = require("./OAuth/passport");
const authRoutes = require("./routes/authRoutes");
const contactRoutes = require("./routes/contactRoutes");
const bulkImportRoutes = require("./routes/bulkImportRoutes");

//middlewares

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://crazydealsonline.in",
      "https://www.crazydealsonline.in",
    ],
    credentials: true,
  })
);

// Initialize Passport
app.use(passport.initialize());

app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.json({ limit: "16kb" }));

app.get("/", (req, res) => {
  res.send("Hello");
});

// routes

//user
app.use("/api/users", userRoutes);

//books
app.use("/api/books", bookRoutes);

//bulk uploads
app.use("/api/bulk-import", bulkImportRoutes);

// cart
app.use("/api/cart", cartRoutes);

// orders
app.use("/api/orders", orderRoutes);

// OAuth routes
app.use("/api/auth", authRoutes);

// Contact routes
app.use("/api/contact", contactRoutes);

module.exports = app;
