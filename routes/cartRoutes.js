// routes/cartRoutes.js
const express = require("express");
const router = express.Router();
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  applyCoupon,
} = require("../controllers/cartController");
const { authMiddleware } = require("../middlewares/authMiddleware");

// All cart routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/cart
 * @desc    Get user's cart
 * @access  Private
 */
router.get("/", getCart);

/**
 * @route   POST /api/cart/add
 * @desc    Add item to cart
 * @access  Private
 * @body    {bookId, quantity}
 */
router.post("/add", addToCart);

/**
 * @route   PUT /api/cart/items/:bookId
 * @desc    Update cart item quantity
 * @access  Private
 * @params  bookId
 * @body    {quantity}
 */
router.put("/items/:bookId", updateCartItem);

/**
 * @route   DELETE /api/cart/items/:bookId
 * @desc    Remove item from cart
 * @access  Private
 * @params  bookId
 */
router.delete("/items/:bookId", removeFromCart);

/**
 * @route   DELETE /api/cart/clear
 * @desc    Clear entire cart
 * @access  Private
 */
router.delete("/clear", clearCart);

/**
 * @route   POST /api/cart/apply-coupon
 * @desc    Apply coupon to cart
 * @access  Private
 * @body    {couponCode, discount, discountType}
 */
router.post("/apply-coupon", applyCoupon);

module.exports = router;
