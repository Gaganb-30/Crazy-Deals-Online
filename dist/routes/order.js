"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../prisma"));
const authMiddleware_1 = require("../middlewares/authMiddleware");
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const router = (0, express_1.Router)();
// Initialize Razorpay
const razorpay = new razorpay_1.default({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});
// All order routes require authentication
router.use(authMiddleware_1.authMiddleware);
// ========================
// 📋 Get User's Orders
// ========================
router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId;
        const orders = await prisma_1.default.order.findMany({
            where: { userId },
            include: {
                items: {
                    include: {
                        book: {
                            select: {
                                id: true,
                                title: true,
                                format: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        return res.json({ orders });
    }
    catch (error) {
        console.error('Get Orders Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});
// ========================
// 🔍 Get Single Order
// ========================
router.get('/:orderId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { orderId } = req.params;
        const order = await prisma_1.default.order.findFirst({
            where: {
                id: orderId,
                userId: userId,
            },
            include: {
                items: {
                    include: {
                        book: {
                            select: {
                                id: true,
                                title: true,
                                format: true,
                                publisher: true,
                            },
                        },
                    },
                },
            },
        });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        return res.json({ order });
    }
    catch (error) {
        console.error('Get Order Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});
// ========================
// 💳 Create Razorpay Order
// ========================
router.post('/create-payment', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { shippingAddress } = req.body;
        if (!shippingAddress) {
            return res.status(400).json({ message: 'Shipping address is required' });
        }
        // Get user's cart
        const cart = await prisma_1.default.cart.findUnique({
            where: { userId },
            include: {
                items: {
                    include: {
                        book: true,
                    },
                },
            },
        });
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ message: 'Cart is empty' });
        }
        // Check if all books are available
        const unavailableBooks = cart.items.filter((item) => !item.book.available);
        if (unavailableBooks.length > 0) {
            return res.status(400).json({
                message: 'Some books are not available',
                unavailableBooks: unavailableBooks.map((item) => item.book.title),
            });
        }
        // Calculate total amount
        const totalAmount = cart.items.reduce((sum, item) => sum + item.book.price * item.quantity, 0);
        // Create Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(totalAmount * 100), // amount in paise
            currency: 'INR',
            receipt: `order_${Date.now()}`,
            notes: {
                userId,
                cartId: cart.id.toString(),
            },
        });
        // Create order in database
        const order = await prisma_1.default.order.create({
            data: {
                userId,
                totalAmount,
                paymentOrderId: razorpayOrder.id,
                shippingAddress,
                items: {
                    create: cart.items.map((item) => ({
                        bookId: item.bookId,
                        quantity: item.quantity,
                        price: item.book.price,
                    })),
                },
            },
            include: {
                items: {
                    include: {
                        book: true,
                    },
                },
            },
        });
        return res.json({
            message: 'Payment order created',
            order: {
                id: order.id,
                razorpayOrderId: razorpayOrder.id,
                amount: totalAmount,
                currency: 'INR',
            },
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        });
    }
    catch (error) {
        console.error('Create Payment Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});
// ========================
// ✅ Verify Payment
// ========================
router.post('/verify-payment', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: 'Missing payment details' });
        }
        // Verify signature
        const generatedSignature = crypto_1.default
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');
        if (generatedSignature !== razorpay_signature) {
            // Update order as failed
            await prisma_1.default.order.updateMany({
                where: {
                    paymentOrderId: razorpay_order_id,
                    userId,
                },
                data: {
                    paymentStatus: 'FAILED',
                },
            });
            return res.status(400).json({ message: 'Payment verification failed' });
        }
        // Update order with payment details
        const order = await prisma_1.default.order.updateMany({
            where: {
                paymentOrderId: razorpay_order_id,
                userId,
            },
            data: {
                paymentId: razorpay_payment_id,
                paymentSignature: razorpay_signature,
                paymentStatus: 'COMPLETED',
                status: 'CONFIRMED',
            },
        });
        // Clear user's cart
        const cart = await prisma_1.default.cart.findUnique({
            where: { userId },
        });
        if (cart) {
            await prisma_1.default.cartItem.deleteMany({
                where: { cartId: cart.id },
            });
        }
        return res.json({
            message: 'Payment verified successfully',
            success: true,
        });
    }
    catch (error) {
        console.error('Verify Payment Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});
// ========================
// ❌ Cancel Order (Only PENDING orders)
// ========================
router.patch('/cancel/:orderId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { orderId } = req.params;
        const order = await prisma_1.default.order.findFirst({
            where: {
                id: orderId,
                userId,
            },
        });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        if (order.status !== 'PENDING') {
            return res
                .status(400)
                .json({ message: 'Only pending orders can be cancelled' });
        }
        const updatedOrder = await prisma_1.default.order.update({
            where: { id: orderId },
            data: {
                status: 'CANCELLED',
            },
        });
        return res.json({
            message: 'Order cancelled',
            order: updatedOrder,
        });
    }
    catch (error) {
        console.error('Cancel Order Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});
// ========================
// 👨‍💼 Admin: Get All Orders
// ========================
router.get('/admin/all', (0, authMiddleware_1.restrictTo)(['ADMIN']), async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const where = {};
        if (status) {
            where.status = status;
        }
        const orders = await prisma_1.default.order.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                items: {
                    include: {
                        book: {
                            select: {
                                id: true,
                                title: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit),
        });
        const total = await prisma_1.default.order.count({ where });
        return res.json({
            orders,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        console.error('Get All Orders Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});
// ========================
// 👨‍💼 Admin: Update Order Status
// ========================
router.patch('/admin/status/:orderId', (0, authMiddleware_1.restrictTo)(['ADMIN']), async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        const validStatuses = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }
        const order = await prisma_1.default.order.update({
            where: { id: orderId },
            data: { status },
            include: {
                items: {
                    include: {
                        book: true,
                    },
                },
            },
        });
        return res.json({
            message: 'Order status updated',
            order,
        });
    }
    catch (error) {
        console.error('Update Order Status Error:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});
exports.default = router;
