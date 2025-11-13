const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Book = require("../models/Book");
const User = require("../models/User");
const {
  validateAddress,
  isAddressComplete,
} = require("../utils/addressValidator");
const razorpay = require("razorpay");
const crypto = require("crypto");
const dotenv = require("dotenv");
const { sendOrderNotification } = require("../utils/emailService");

dotenv.config();

// Initialize Razorpay
const razorpayInstance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ========================
// 🎯 CONTROLLER FUNCTIONS
// ========================

/**
 * Get user's orders
 */
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 10, status } = req.query;

    // Build filter
    const filter = { user: userId };
    if (status) filter.status = status;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        {
          path: "items.book",
          select: "id title author format images price", // Added price for consistency
        },
      ],
    };

    const orders = await Order.paginate(filter, options);

    res.json({
      success: true,
      message: "Orders retrieved successfully",
      data: {
        orders: orders.docs,
        pagination: {
          currentPage: orders.page,
          totalPages: orders.totalPages,
          totalOrders: orders.totalDocs,
          hasNext: orders.hasNextPage,
          hasPrev: orders.hasPrevPage,
        },
      },
    });
  } catch (error) {
    console.error("Get User Orders Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

/**
 * Get single order
 */
const getOrderById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      user: userId,
    }).populate({
      path: "items.book",
      select: "id title author format publisher images price", // Added price
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      message: "Order retrieved successfully",
      data: { order },
    });
  } catch (error) {
    console.error("Get Order Error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message,
    });
  }
};

/**
 * Create Razorpay payment order
 */
/**
 * Create Razorpay payment order
 */
const createPaymentOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      shippingAddress,
      paymentMethod = "RAZORPAY",
      useSavedAddress = true,
    } = req.body;

    // Get user with saved address
    const user = await User.findById(userId).select(
      "name email phone optionalPhone address"
    );
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    let finalShippingAddress = shippingAddress;
    user.address.phone = user.phone;

    // If no shipping address provided and user wants to use saved address
    if (!shippingAddress && useSavedAddress) {
      // Check if user has a saved address that's complete
      if (!isAddressComplete(user.address)) {
        return res.status(400).json({
          success: false,
          message:
            "No shipping address provided or no complete saved address found",
          data: {
            requiresAddress: true,
            hasSavedAddress: !!user.address,
            savedAddress: user.address,
            addressIncomplete: true,
          },
        });
      }

      // Use the user's saved address
      finalShippingAddress = {
        phone: user.address.phone,
        optionalPhone: user.optionalPhone,
        hNo: user.address.hNo,
        street: user.address.street,
        city: user.address.city,
        state: user.address.state,
        zipCode: user.address.zipCode,
        country: user.address.country || "India",
      };
    }

    // Validate shipping address
    const addressValidation = validateAddress(finalShippingAddress);
    if (!addressValidation.isValid) {
      return res.status(400).json({
        success: false,
        message:
          "Complete shipping address is required (phone, hNo, street, city, state, zipCode)",
        data: {
          requiresAddress: true,
          validationErrors: addressValidation.errors,
          providedAddress: finalShippingAddress,
        },
      });
    }

    // Get user's cart with populated items
    const cart = await Cart.findOne({ user: userId }).populate({
      path: "items.book",
      select: "id title author price available stock format images details",
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      });
    }

    // Check book availability and stock
    const unavailableBooks = [];
    const outOfStockBooks = [];

    for (const item of cart.items) {
      const book = item.book;
      if (!book.available) {
        unavailableBooks.push({
          title: book.title,
          id: book._id,
        });
      }
      if (book.stock < item.quantity) {
        outOfStockBooks.push({
          title: book.title,
          id: book._id,
          requested: item.quantity,
          available: book.stock,
        });
      }
    }

    if (unavailableBooks.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Some books are not available",
        data: { unavailableBooks },
      });
    }

    if (outOfStockBooks.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Insufficient stock for some books",
        data: { outOfStockBooks },
      });
    }

    // USE CART VIRTUALS FOR CONSISTENT CALCULATIONS
    const totalAmount = cart.totalPrice;
    const discount = cart.savings || 0;
    const deliveryCharge = cart.deliveryCharge || 0;
    const finalAmount = cart.finalTotal;

    if (finalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order amount",
      });
    }

    let razorpayOrder = null;

    // Create Razorpay order only for online payments
    if (paymentMethod === "RAZORPAY") {
      try {
        razorpayOrder = await razorpayInstance.orders.create({
          amount: Math.round(finalAmount * 100), // Convert to paise
          currency: "INR",
          receipt: `order_${Date.now()}`,
          notes: {
            userId: userId.toString(),
            cartId: cart._id.toString(),
          },
        });
      } catch (razorpayError) {
        console.error("Razorpay Order Creation Error:", razorpayError);
        return res.status(500).json({
          success: false,
          message: "Failed to create payment order",
          error: "PAYMENT_GATEWAY_ERROR",
        });
      }
    }

    // Create order in database
    const orderData = {
      user: userId,
      items: cart.items.map((item) => ({
        book: item.book._id,
        quantity: item.quantity,
        price: item.price,
        title: item.book.title,
        author: item.book.author,
        format: item.book.format,
      })),
      totalAmount,
      discount,
      discount: cart.savings || 0,
      deliveryCharge,
      finalAmount,
      totalItems: cart.totalItems,
      totalWeight: cart.totalWeight,
      savings: cart.savings,
      paymentMethod,
      shippingAddress: finalShippingAddress,
      billingAddress: finalShippingAddress,
      razorpay: razorpayOrder
        ? {
            orderId: razorpayOrder.id,
          }
        : undefined,
      paymentStatus:
        paymentMethod === "CASH_ON_DELIVERY" ? "PENDING" : "PENDING",
    };

    const order = await Order.create(orderData);

    // For cash on delivery, mark as confirmed directly
    if (paymentMethod === "CASH_ON_DELIVERY") {
      order.status = "CONFIRMED";
      await order.save();

      // Clear cart and update book stock
      await clearCartAndUpdateStock(cart, order.items);
      try {
        const user = await User.findById(userId);
        await sendOrderNotification(order, user, "placed");
      } catch (emailError) {
        console.error("Failed to send order confirmation email:", emailError);
        // Don't throw error, just log it
      }
    }

    // CONSISTENT RESPONSE STRUCTURE
    res.status(201).json({
      success: true,
      message:
        paymentMethod === "CASH_ON_DELIVERY"
          ? "Order placed successfully"
          : "Payment order created",
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          totalAmount,
          discount,
          deliveryCharge,
          finalAmount,
          totalItems: order.totalItems,
          status: order.status,
          paymentMethod,
          shippingAddress: order.shippingAddress,
          usedSavedAddress: !shippingAddress && useSavedAddress,
          freeDelivery: totalAmount >= 1500, // Explicit flag for frontend
          freeDeliveryThreshold: 1500,
        },
        ...(razorpayOrder && {
          razorpayOrderId: razorpayOrder.id,
          amount: finalAmount,
          currency: "INR",
          razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        }),
      },
    });
  } catch (error) {
    console.error("Create Payment Order Error:", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create payment order",
      error: error.message,
    });
  }
};

/**
 * Verify Razorpay payment
 */
const verifyPayment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    // Validation
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment details",
      });
    }

    // Find the order
    const order = await Order.findOne({
      "razorpay.orderId": razorpay_order_id,
      user: userId,
    }).populate("items.book");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      // Update order as failed
      order.paymentStatus = "FAILED";
      order.status = "CANCELLED";
      await order.save();

      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    // Update order with payment details
    order.razorpay.paymentId = razorpay_payment_id;
    order.razorpay.signature = razorpay_signature;
    order.paymentStatus = "COMPLETED";
    order.status = "CONFIRMED";
    await order.save();

    // Get user's cart and clear it - USE CART MODEL'S CLEAR METHOD
    const cart = await Cart.findOne({ user: userId });
    if (cart) {
      await clearCartAndUpdateStock(cart, order.items);
    }

    try {
      const user = await User.findById(userId);
      await sendOrderNotification(order, user, "placed");
    } catch (emailError) {
      console.error("Failed to send order confirmation email:", emailError);
      // Don't throw error, just log it
    }

    res.json({
      success: true,
      message: "Payment verified successfully",
      data: {
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          finalAmount: order.finalAmount,
        },
      },
    });
  } catch (error) {
    console.error("Verify Payment Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify payment",
      error: error.message,
    });
  }
};

/**
 * Cancel order
 */
const cancelOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const order = await Order.findOne({
      _id: orderId,
      user: userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if order can be cancelled
    if (!order.canBeCancelled || !order.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled in ${order.status} status`,
      });
    }

    // Update order status
    order.status = "CANCELLED";
    if (order.paymentStatus === "COMPLETED") {
      order.paymentStatus = "REFUND_PENDING"; // Consider making this REFUNDED after actual refund
    } else {
      order.paymentStatus = "FAILED";
    }
    order.cancellationReason = reason || "Cancelled by user";
    order.cancelledAt = new Date();
    await order.save();

    // Restore book stock
    await restoreBookStock(order.items);

    // Send cancellation email
    try {
      const user = await User.findById(userId);
      await sendOrderNotification(order, user, "cancelled");
    } catch (emailError) {
      console.error("Failed to send cancellation email:", emailError);
      // Don't throw error, just log it
    }

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: { order },
    });
  } catch (error) {
    console.error("Cancel Order Error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
      error: error.message,
    });
  }
};

/**
 * Get all orders (Admin only)
 */
const getAllOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      startDate,
      endDate,
      userId,
    } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (userId) filter.user = userId;

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        {
          path: "user",
          select: "id name email phone",
        },
        {
          path: "items.book",
          select: "id title author images price format", // Added price and format
        },
      ],
    };

    const orders = await Order.paginate(filter, options);

    res.json({
      success: true,
      message: "All orders retrieved successfully",
      data: {
        orders: orders.docs,
        pagination: {
          currentPage: orders.page,
          totalPages: orders.totalPages,
          totalOrders: orders.totalDocs,
          hasNext: orders.hasNextPage,
          hasPrev: orders.hasPrevPage,
        },
      },
    });
  } catch (error) {
    console.error("Get All Orders Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

/**
 * Update order status (Admin only)
 */
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, trackingLink, notes } = req.body; // Removed trackingNumber, carrier

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required",
      });
    }

    const validStatuses = [
      "PENDING",
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update order status using model method
    await order.updateStatus(status, notes, true);

    // Handle tracking link for shipped orders
    if (status === "SHIPPED" && trackingLink) {
      await order.addTrackingLink(trackingLink);
    }

    // Populate order for response
    const updatedOrder = await Order.findById(orderId)
      .populate("user", "name email phone")
      .populate("items.book", "id title author images price format");

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: {
        order: updatedOrder,
        trackingLink: updatedOrder.deliveryTracking?.trackingLink,
      },
    });
  } catch (error) {
    console.error("Update Order Status Error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

/**
 * Get order statistics (Admin only)
 */
const getOrderStats = async (req, res) => {
  try {
    const { period = "month" } = req.query; // day, week, month, year

    const now = new Date();
    let startDate;

    switch (period) {
      case "day":
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case "week":
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const stats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$finalAmount" },
          averageOrderValue: { $avg: "$finalAmount" },
          totalItemsSold: { $sum: "$totalItems" },
        },
      },
    ]);

    // Get orders by status
    const statusStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          revenue: { $sum: "$finalAmount" },
        },
      },
    ]);

    // Get revenue by payment method
    const paymentStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] },
        },
      },
      {
        $group: {
          _id: "$paymentMethod",
          count: { $sum: 1 },
          revenue: { $sum: "$finalAmount" },
        },
      },
    ]);

    const result = {
      period,
      startDate,
      endDate: new Date(),
      ...(stats[0] || {
        totalOrders: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        totalItemsSold: 0,
      }),
      statusBreakdown: statusStats.reduce((acc, stat) => {
        acc[stat._id] = { count: stat.count, revenue: stat.revenue };
        return acc;
      }, {}),
      paymentBreakdown: paymentStats.reduce((acc, stat) => {
        acc[stat._id] = { count: stat.count, revenue: stat.revenue };
        return acc;
      }, {}),
    };

    res.json({
      success: true,
      message: "Order statistics retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get Order Stats Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order statistics",
      error: error.message,
    });
  }
};

// ========================
// 🛠️ HELPER FUNCTIONS
// ========================

/**
 * Clear cart and update book stock after successful order (Bulk version)
 */
const clearCartAndUpdateStock = async (cart, orderItems) => {
  try {
    // Clear cart items
    await cart.clear();

    // Get all book IDs to update
    const bookIds = orderItems.map((item) => item.book);
    const books = await Book.find({ _id: { $in: bookIds } });

    const bulkOps = [];

    for (const item of orderItems) {
      const book = books.find((b) => b._id.toString() === item.book.toString());
      if (book) {
        const newStock = book.stock - item.quantity;
        const updateData = {
          stock: newStock,
        };

        if (newStock <= 0) {
          updateData.available = false;
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: item.book },
            update: updateData,
          },
        });
      }
    }

    if (bulkOps.length > 0) {
      await Book.bulkWrite(bulkOps);
    }
  } catch (error) {
    console.error("Error in clearCartAndUpdateStock:", error);
    throw error;
  }
};

/**
 * Restore book stock when order is cancelled (Bulk version)
 */
const restoreBookStock = async (orderItems) => {
  try {
    const bulkOps = orderItems.map((item) => ({
      updateOne: {
        filter: { _id: item.book },
        update: {
          $inc: { stock: item.quantity },
          $set: { available: true },
        },
      },
    }));

    if (bulkOps.length > 0) {
      await Book.bulkWrite(bulkOps);
    }
  } catch (error) {
    console.error("Error in restoreBookStock:", error);
    throw error;
  }
};

// ========================
// 📦 EXPORT CONTROLLERS
// ========================
module.exports = {
  getUserOrders,
  getOrderById,
  createPaymentOrder,
  verifyPayment,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  getOrderStats,
};
