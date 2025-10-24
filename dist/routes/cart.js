"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// All cart routes require authentication
router.use(authMiddleware_1.authMiddleware);
// ========================
// 📦 Get User's Cart
// ========================
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        let cart = await prisma_1.default.cart.findUnique({
            where: { userId },
            include: {
                items: {
                    include: {
                        book: {
                            select: {
                                id: true,
                                title: true,
                                price: true,
                                available: true,
                                format: true,
                            },
                        },
                    },
                },
            },
        });
        // Create cart if doesn't exist
        if (!cart) {
            cart = await prisma_1.default.cart.create({
                data: { userId },
                include: {
                    items: {
                        include: {
                            book: {
                                select: {
                                    id: true,
                                    title: true,
                                    price: true,
                                    available: true,
                                    format: true,
                                },
                            },
                        },
                    },
                },
            });
        }
        // Calculate total
        const total = cart.items.reduce((sum, item) => sum + item.book.price * item.quantity, 0);
        return res.json({
            cart: {
                id: cart.id,
                items: cart.items,
                total: total.toFixed(2),
                itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
            },
        });
    }
    catch (error) {
        console.error('Get Cart Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});
// ========================
// ➕ Add Item to Cart
// ========================
router.post('/add', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { bookId, quantity = 1 } = req.body;
        if (!bookId) {
            return res.status(400).json({ message: 'Book ID is required' });
        }
        // Check if book exists and is available
        const book = await prisma_1.default.book.findUnique({
            where: { id: Number(bookId) },
        });
        if (!book) {
            return res.status(404).json({ message: 'Book not found' });
        }
        if (!book.available) {
            return res.status(400).json({ message: 'Book is not available' });
        }
        // Get or create cart
        let cart = await prisma_1.default.cart.findUnique({
            where: { userId },
        });
        if (!cart) {
            cart = await prisma_1.default.cart.create({
                data: { userId },
            });
        }
        // Check if item already exists in cart
        const existingItem = await prisma_1.default.cartItem.findUnique({
            where: {
                cartId_bookId: {
                    cartId: cart.id,
                    bookId: Number(bookId),
                },
            },
        });
        if (existingItem) {
            // Update quantity
            const updatedItem = await prisma_1.default.cartItem.update({
                where: { id: existingItem.id },
                data: {
                    quantity: existingItem.quantity + quantity,
                },
                include: {
                    book: {
                        select: {
                            id: true,
                            title: true,
                            price: true,
                        },
                    },
                },
            });
            return res.json({
                message: 'Cart updated',
                item: updatedItem,
            });
        }
        else {
            // Add new item
            const newItem = await prisma_1.default.cartItem.create({
                data: {
                    cartId: cart.id,
                    bookId: Number(bookId),
                    quantity,
                },
                include: {
                    book: {
                        select: {
                            id: true,
                            title: true,
                            price: true,
                        },
                    },
                },
            });
            return res.status(201).json({
                message: 'Item added to cart',
                item: newItem,
            });
        }
    }
    catch (error) {
        console.error('Add to Cart Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});
// ========================
// 🔄 Update Cart Item Quantity
// ========================
router.patch('/update/:itemId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { itemId } = req.params;
        const { quantity } = req.body;
        if (!quantity || quantity < 1) {
            return res.status(400).json({ message: 'Valid quantity is required' });
        }
        // Verify item belongs to user's cart
        const item = await prisma_1.default.cartItem.findUnique({
            where: { id: Number(itemId) },
            include: { cart: true },
        });
        if (!item || item.cart.userId !== userId) {
            return res.status(404).json({ message: 'Cart item not found' });
        }
        const updatedItem = await prisma_1.default.cartItem.update({
            where: { id: Number(itemId) },
            data: { quantity },
            include: {
                book: {
                    select: {
                        id: true,
                        title: true,
                        price: true,
                    },
                },
            },
        });
        return res.json({
            message: 'Quantity updated',
            item: updatedItem,
        });
    }
    catch (error) {
        console.error('Update Cart Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});
// ========================
// ❌ Remove Item from Cart
// ========================
router.delete('/remove/:itemId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { itemId } = req.params;
        // Verify item belongs to user's cart
        const item = await prisma_1.default.cartItem.findUnique({
            where: { id: Number(itemId) },
            include: { cart: true },
        });
        if (!item || item.cart.userId !== userId) {
            return res.status(404).json({ message: 'Cart item not found' });
        }
        await prisma_1.default.cartItem.delete({
            where: { id: Number(itemId) },
        });
        return res.json({ message: 'Item removed from cart' });
    }
    catch (error) {
        console.error('Remove from Cart Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});
// ========================
// 🗑️ Clear Cart
// ========================
router.delete('/clear', async (req, res) => {
    try {
        const userId = req.user.userId;
        const cart = await prisma_1.default.cart.findUnique({
            where: { userId },
        });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }
        await prisma_1.default.cartItem.deleteMany({
            where: { cartId: cart.id },
        });
        return res.json({ message: 'Cart cleared' });
    }
    catch (error) {
        console.error('Clear Cart Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});
exports.default = router;
