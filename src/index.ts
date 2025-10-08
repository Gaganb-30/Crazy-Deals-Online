import express from "express";
import bookRoutes from './routes/book';
import userRoutes from './routes/user';
import prisma from "./prisma";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT;
const app = express();

app.use(express.json());      

app.get('/',(req, res) => {
  console.log("Get request");
  return res.json({msg:"GET request"});
})

app.use("/books", bookRoutes);
app.use("/user", userRoutes);

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