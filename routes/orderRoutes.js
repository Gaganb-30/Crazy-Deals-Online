const express = require("express");
const router = express.Router();
const {
  getUserOrders,
  getOrderById,
  createPaymentOrder,
  verifyPayment,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  getOrderStats,
} = require("../controllers/orderController");
const { authMiddleware, restrictTo } = require("../middlewares/authMiddleware");

// All order routes require authentication
router.use(authMiddleware);

// ========================
// 🔐 USER ROUTES
// ========================

/**
 * @route   GET /api/orders
 * @desc    Get current user's orders
 * @access  Private
 * @query   page, limit, status
 */
router.get("/", getUserOrders);

/**
 * @route   GET /api/orders/:orderId
 * @desc    Get single order by ID
 * @access  Private
 * @params  orderId
 */
router.get("/:orderId", getOrderById);

/**
 * @route   POST /api/orders/create-payment
 * @desc    Create Razorpay payment order
 * @access  Private
 * @body    {shippingAddress, paymentMethod}
 */
router.post("/create-payment", createPaymentOrder);

/**
 * @route   POST /api/orders/verify-payment
 * @desc    Verify Razorpay payment
 * @access  Private
 * @body    {razorpay_order_id, razorpay_payment_id, razorpay_signature}
 */
router.post("/verify-payment", verifyPayment);

/**
 * @route   PATCH /api/orders/cancel/:orderId
 * @desc    Cancel an order
 * @access  Private
 * @params  orderId
 * @body    {reason}
 */
router.patch("/cancel/:orderId", cancelOrder);

// ========================
// 🛡️ ADMIN ROUTES
// ========================

/**
 * @route   GET /api/orders/admin/all
 * @desc    Get all orders (Admin only)
 * @access  Private/Admin
 * @query   page, limit, status, paymentStatus, startDate, endDate, userId
 */
router.get("/admin/all", restrictTo(["ADMIN"]), getAllOrders);

/**
 * @route   GET /api/orders/admin/stats
 * @desc    Get order statistics (Admin only)
 * @access  Private/Admin
 * @query   period (day, week, month, year)
 */
router.get("/admin/stats", restrictTo(["ADMIN"]), getOrderStats);

/**
 * @route   PATCH /api/orders/admin/status/:orderId
 * @desc    Update order status (Admin only)
 * @access  Private/Admin
 * @params  orderId
 * @body    {status, trackingNumber, carrier, notes}
 */
router.patch(
  "/admin/status/:orderId",
  restrictTo(["ADMIN"]),
  updateOrderStatus
);

module.exports = router;
