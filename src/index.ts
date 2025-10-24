import express from "express";
import bookRoutes from './routes/book';
import userRoutes from './routes/user';
import cartRoutes from './routes/cart';
import cors from 'cors';
// import orderRoutes from './routes/order';
import prisma from "./prisma";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use(cors());

app.get('/',(req, res) => {
  console.log("Get request");
  return res.json({
    msg: "Bookstore API",
    version: "1.0.0",
    endpoints: {
      books: "/books",
      user: "/user",
      cart: "/cart",
      orders: "/orders"
    }
  });
})

app.use("/books", bookRoutes);
app.use("/user", userRoutes);
app.use("/cart", cartRoutes);
// app.use("/orders", orderRoutes);

// Gracefully disconnect Prisma when app exits
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => console.log("Server started at PORT : " + PORT));