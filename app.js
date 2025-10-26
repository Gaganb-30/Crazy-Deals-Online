const express = require("express"); //
const app = express(); //
const cors = require("cors"); //
const userRoutes = require("./routes/userRoutes");
const bookRoutes = require("./routes/bookRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");
// const cookieParser = require('cookie-parser');
// const gameRequestRoutes = require('./routes/gameRequestRoutes');
// const gameRandomizerRoutes = require('./routes/gameRandomizerRoutes');
// const { xAuthMiddleware } = require('./middlewares/auth');
// const { authMiddleware } = require('./middlewares/authMiddleware');
// const commentRoutes = require('./routes/commentRoutes');

//middlewares
// app.set("trust proxy", true);

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://bookstore-frontend-react-v1.onrender.com",
      // 'https://toxicgames.in',
      // 'http://toxicgames.in'
    ],
    credentials: true,
  })
);
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.json({ limit: "16kb" }));
// app.use(cookieParser());

//

app.get("/", (req, res) => {
  res.send("Hello");
});

// routes

//user
app.use("/api/users", userRoutes);

//books
app.use("/api/books", bookRoutes);

// cart
app.use("/api/cart", cartRoutes);

// orders
app.use("/api/orders", orderRoutes);

// // game request
// app.use("/api/requests", xAuthMiddleware, gameRequestRoutes);

// // game randomizer
// app.use("/api/random", xAuthMiddleware, gameRandomizerRoutes);

// // comments
// app.use("/api/comments", xAuthMiddleware, commentRoutes);

module.exports = app;
