const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Book = require("../models/Book");
const User = require("../models/User");
const razorpay = require("razorpay");
const crypto = require("crypto");

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
          select: "id title author format images",
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
      select: "id title author format publisher images",
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
const createPaymentOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { shippingAddress, paymentMethod = "RAZORPAY" } = req.body;

    // Validation
    if (
      !shippingAddress ||
      !shippingAddress.street ||
      !shippingAddress.city ||
      !shippingAddress.state ||
      !shippingAddress.zipCode
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Complete shipping address is required (street, city, state, zipCode)",
      });
    }

    // Get user's cart with populated items
    const cart = await Cart.findOne({ user: userId }).populate({
      path: "items.book",
      select: "id title price available stock format author",
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
      if (!item.book.available) {
        unavailableBooks.push(item.book.title);
      }
      if (item.book.stock < item.quantity) {
        outOfStockBooks.push({
          title: item.book.title,
          requested: item.quantity,
          available: item.book.stock,
        });
      }
    }

    if (unavailableBooks.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Some books are not available",
        unavailableBooks,
      });
    }

    if (outOfStockBooks.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Insufficient stock for some books",
        outOfStockBooks,
      });
    }

    // Calculate total amount
    const totalAmount = cart.items.reduce((total, item) => {
      return total + item.price * item.quantity;
    }, 0);

    // Apply discount if any
    const discount = cart.discount || 0;
    const finalAmount = totalAmount - discount;

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
      })),
      totalAmount,
      discount,
      finalAmount,
      paymentMethod,
      shippingAddress,
      billingAddress: shippingAddress, // Same as shipping for now
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
    }

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
          finalAmount,
          status: order.status,
          paymentMethod,
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

    // Get user's cart and clear it
    const cart = await Cart.findOne({ user: userId });
    if (cart) {
      await clearCartAndUpdateStock(cart, order.items);
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
    if (!order.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled in ${order.status} status`,
      });
    }

    // Update order status
    order.status = "CANCELLED";
    order.paymentStatus =
      order.paymentStatus === "COMPLETED" ? "REFUNDED" : "FAILED";
    order.notes = reason ? `Cancelled: ${reason}` : "Cancelled by user";
    order.cancelledAt = new Date();
    await order.save();

    // Restore book stock
    await restoreBookStock(order.items);

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
          select: "id title author images",
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
    const { status, trackingNumber, carrier, notes } = req.body;

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

    // Update order status
    const updateData = { status };
    if (notes) {
      updateData.notes = order.notes ? `${order.notes}\n${notes}` : notes;
    }

    // Handle tracking information
    if (status === "SHIPPED") {
      updateData.tracking = {
        carrier: carrier || "Standard",
        trackingNumber: trackingNumber,
        trackingUrl: trackingNumber
          ? `https://tracking.example.com/${trackingNumber}`
          : undefined,
      };
      updateData.estimatedDelivery = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ); // 7 days from now
    }

    if (status === "DELIVERED") {
      updateData.deliveredAt = new Date();
      updateData.paymentStatus = "COMPLETED"; // Ensure payment is marked complete on delivery for COD
    }

    const updatedOrder = await Order.findByIdAndUpdate(orderId, updateData, {
      new: true,
      runValidators: true,
    }).populate("user", "name email phone");

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: { order: updatedOrder },
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
          paymentStatus: "COMPLETED",
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$finalAmount" },
          averageOrderValue: { $avg: "$finalAmount" },
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
      }),
      statusBreakdown: statusStats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
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
 * Clear cart and update book stock after successful order
 */
const clearCartAndUpdateStock = async (cart, orderItems) => {
  try {
    // Clear cart items
    cart.items = [];
    await cart.save();

    // Update book stock
    for (const item of orderItems) {
      await Book.findByIdAndUpdate(item.book, {
        $inc: { stock: -item.quantity },
      });
    }
  } catch (error) {
    console.error("Error in clearCartAndUpdateStock:", error);
    throw error;
  }
};

/**
 * Restore book stock when order is cancelled
 */
const restoreBookStock = async (orderItems) => {
  try {
    for (const item of orderItems) {
      await Book.findByIdAndUpdate(item.book, {
        $inc: { stock: item.quantity },
      });
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
