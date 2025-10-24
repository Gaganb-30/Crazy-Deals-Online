"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const book_1 = __importDefault(require("./routes/book"));
const user_1 = __importDefault(require("./routes/user"));
const cart_1 = __importDefault(require("./routes/cart"));
const cors_1 = __importDefault(require("cors"));
// import orderRoutes from './routes/order';
const prisma_1 = __importDefault(require("./prisma"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const PORT = process.env.PORT || 3000;
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
app.get('/', (req, res) => {
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
});
app.use("/books", book_1.default);
app.use("/user", user_1.default);
app.use("/cart", cart_1.default);
// app.use("/orders", orderRoutes);
// Gracefully disconnect Prisma when app exits
process.on("SIGINT", async () => {
    await prisma_1.default.$disconnect();
    process.exit(0);
});
process.on("SIGTERM", async () => {
    await prisma_1.default.$disconnect();
    process.exit(0);
});
app.listen(PORT, () => console.log("Server started at PORT : " + PORT));
