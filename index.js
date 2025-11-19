const express = require("express");
const app = require("./app");
const dotenv = require("dotenv");
const connectDb = require("./db/db");

dotenv.config();
const PORT = process.env.PORT;
// console.log("PORT is : ", PORT);
// console.log("mongo is : ", process.env.MONGO_URI);

// MongoDB connection
connectDb()
  .then(() => {
    console.log("MongoDB is connected");

    // Start server AFTER DB connection
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server is running on port: ${PORT}`);
    });
  })
  .catch((err) => {
    console.log(`MongoDB connection error ${err}`);
    process.exit(1);
  });
