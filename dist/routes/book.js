"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    const books = await prisma_1.default.book.findMany({
        select: {
            id: true,
            title: true,
            price: true,
            available: true,
        }
    });
    res.json({ books: books });
});
router.post('/create', (0, authMiddleware_1.restrictTo)(['ADMIN']), async (req, res) => {
    // router.post('/create', async (req, res) => {
    const body = req.body;
    const book = await prisma_1.default.book.create({
        data: {
            title: body.title,
            publisher: body.publisher,
            language: body.language,
            price: body.price,
            about: body.about,
            format: body.format,
            details: {
                create: {
                    isbn: body.isbn,
                    pages: body.pages,
                    country: body.country,
                }
            }
        }
    });
    res.json(book);
});
router.get('/:id', async (req, res) => {
    const book = await prisma_1.default.book.findUnique({
        where: {
            id: Number(req.params.id),
        },
        include: {
            details: true,
        }
    });
    res.json(book);
});
exports.default = router;
