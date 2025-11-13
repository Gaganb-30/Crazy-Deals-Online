// controllers/cartController.js
const Cart = require("../models/Cart");
const Book = require("../models/Book");

/**
 * Get user's cart
 */
const getCart = async (req, res) => {
  try {
    const userId = req.user.userId;
    const cart = await Cart.findOne({ user: userId }).populate({
      path: "items.book",
      select: "id title author price available stock format images details",
    });

    if (!cart) {
      // Create empty cart if it doesn't exist
      const newCart = new Cart({ user: userId, items: [] });
      await newCart.save();

      return res.json({
        success: true,
        message: "Cart retrieved successfully",
        data: {
          cart: newCart,
          totalPrice: 0,
          discountedPrice: 0,
          totalItems: 0,
          savings: 0,
          totalWeight: 0,
          deliveryCharge: 0,
          finalTotal: 0,
          freeDeliveryInfo: {
            isFreeDelivery: false,
            message: "Add ₹1500 for FREE delivery",
            threshold: 1500,
            amountNeeded: 1500,
          },
        },
      });
    }

    // ✅ Include freeDeliveryInfo in response
    res.json({
      success: true,
      message: "Cart retrieved successfully",
      data: {
        cart,
        totalPrice: cart.totalPrice,
        discountedPrice: cart.discountedPrice,
        totalItems: cart.totalItems,
        savings: cart.savings,
        totalWeight: cart.totalWeight,
        deliveryCharge: cart.deliveryCharge,
        finalTotal: cart.finalTotal,
        freeDeliveryInfo: cart.freeDeliveryInfo, // Add this line
      },
    });
  } catch (error) {
    console.error("Get Cart Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cart",
      error: error.message,
    });
  }
};

/**
 * Add item to cart
 */
const addToCart = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId, quantity = 1 } = req.body;

    if (!bookId) {
      return res.status(400).json({
        success: false,
        message: "Book ID is required",
      });
    }

    // Validate book exists
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    // Get or create cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [],
      });
    }

    // Add item to cart (this will store price and weight from book.details.weight)
    await cart.addItem(bookId, quantity);

    // Populate the cart with book details for display
    await cart.populate({
      path: "items.book",
      select: "id title author price available stock format images details",
    });

    res.json({
      success: true,
      message: "Item added to cart successfully",
      data: {
        cart,
        totalPrice: cart.totalPrice,
        discountedPrice: cart.discountedPrice,
        totalItems: cart.totalItems,
        savings: cart.savings,
        totalWeight: cart.totalWeight,
        deliveryCharge: cart.deliveryCharge,
        finalTotal: cart.finalTotal,
        freeDeliveryInfo: cart.freeDeliveryInfo, // Add this line
      },
    });
  } catch (error) {
    console.error("Add to Cart Error:", error);

    if (
      error.message.includes("not available") ||
      error.message.includes("stock") ||
      error.message.includes("Cannot add more than")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to add item to cart",
      error: error.message,
    });
  }
};

/**
 * Update cart item quantity
 */
const updateCartItem = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: "Quantity is required",
      });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    await cart.updateQuantity(bookId, quantity);

    // Populate the cart with book details
    await cart.populate({
      path: "items.book",
      select: "id title author price available stock format images details",
    });

    res.json({
      success: true,
      message: "Cart item updated successfully",
      data: {
        cart,
        totalPrice: cart.totalPrice,
        discountedPrice: cart.discountedPrice,
        totalItems: cart.totalItems,
        savings: cart.savings,
        totalWeight: cart.totalWeight,
        deliveryCharge: cart.deliveryCharge,
        finalTotal: cart.finalTotal,
        freeDeliveryInfo: cart.freeDeliveryInfo, // Add this line
      },
    });
  } catch (error) {
    console.error("Update Cart Item Error:", error);

    if (
      error.message.includes("stock") ||
      error.message.includes("Cannot add more than")
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update cart item",
      error: error.message,
    });
  }
};

/**
 * Remove item from cart
 */
const removeFromCart = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { bookId } = req.params;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    await cart.removeItem(bookId);

    // Populate the cart with book details
    await cart.populate({
      path: "items.book",
      select: "id title author price available stock format images details",
    });

    res.json({
      success: true,
      message: "Item removed from cart successfully",
      data: {
        cart,
        totalPrice: cart.totalPrice,
        discountedPrice: cart.discountedPrice,
        totalItems: cart.totalItems,
        savings: cart.savings,
        totalWeight: cart.totalWeight,
        deliveryCharge: cart.deliveryCharge,
        finalTotal: cart.finalTotal,
        freeDeliveryInfo: cart.freeDeliveryInfo,
      },
    });
  } catch (error) {
    console.error("Remove from Cart Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove item from cart",
      error: error.message,
    });
  }
};

/**
 * Clear cart
 */
const clearCart = async (req, res) => {
  try {
    const userId = req.user.userId;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    await cart.clear();

    res.json({
      success: true,
      message: "Cart cleared successfully",
      data: {
        cart,
        totalPrice: 0,
        discountedPrice: 0,
        totalItems: 0,
        savings: 0,
        totalWeight: 0,
        deliveryCharge: 0,
        finalTotal: 0,
      },
    });
  } catch (error) {
    console.error("Clear Cart Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear cart",
      error: error.message,
    });
  }
};

/**
 * Apply coupon to cart
 */
const applyCoupon = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { couponCode, discount, discountType = "percentage" } = req.body;

    if (!couponCode || discount === undefined) {
      return res.status(400).json({
        success: false,
        message: "Coupon code and discount are required",
      });
    }

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    await cart.applyCoupon(couponCode, discount, discountType);

    // Populate the cart with book details
    await cart.populate({
      path: "items.book",
      select: "id title author price available stock format images details",
    });

    res.json({
      success: true,
      message: "Coupon applied successfully",
      data: {
        cart,
        totalPrice: cart.totalPrice,
        discountedPrice: cart.discountedPrice,
        totalItems: cart.totalItems,
        savings: cart.savings,
        totalWeight: cart.totalWeight,
        deliveryCharge: cart.deliveryCharge,
        finalTotal: cart.finalTotal,
        freeDeliveryInfo: cart.freeDeliveryInfo,
      },
    });
  } catch (error) {
    console.error("Apply Coupon Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to apply coupon",
      error: error.message,
    });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  applyCoupon,
};
