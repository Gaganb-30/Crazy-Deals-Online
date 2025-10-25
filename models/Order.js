// models/Order.js
const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },
    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },
    title: String, // Store book title at time of order
    author: String, // Store author at time of order
  },
  {
    _id: true,
  }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [orderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: [0, "Total amount cannot be negative"],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
    },
    finalAmount: {
      type: Number,
      required: true,
      min: [0, "Final amount cannot be negative"],
    },
    status: {
      type: String,
      enum: [
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "REFUNDED",
      ],
      default: "PENDING",
    },
    paymentMethod: {
      type: String,
      enum: ["RAZORPAY", "CASH_ON_DELIVERY", "CARD", "UPI"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: [
        "PENDING",
        "COMPLETED",
        "FAILED",
        "REFUNDED",
        "PARTIALLY_REFUNDED",
      ],
      default: "PENDING",
    },
    // Razorpay payment details
    razorpay: {
      orderId: String,
      paymentId: String,
      signature: String,
    },
    shippingAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, default: "India" },
    },
    billingAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: "India" },
    },
    tracking: {
      carrier: String,
      trackingNumber: String,
      trackingUrl: String,
    },
    notes: String,
    estimatedDelivery: Date,
    deliveredAt: Date,
    cancelledAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
// orderSchema.index({ user: 1, createdAt: -1 });
// orderSchema.index({ orderNumber: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ "razorpay.paymentId": 1 });

// Pre-save middleware to generate order number
orderSchema.pre("save", async function (next) {
  if (this.isNew) {
    const count = await this.constructor.countDocuments();
    this.orderNumber = `ORD${Date.now()}${count.toString().padStart(6, "0")}`;

    // Calculate final amount
    this.finalAmount = this.totalAmount - this.discount;
  }
  next();
});

// Virtual for isCancelled
orderSchema.virtual("isCancelled").get(function () {
  return this.status === "CANCELLED";
});

// Virtual for isDelivered
orderSchema.virtual("isDelivered").get(function () {
  return this.status === "DELIVERED";
});

// Static method to find orders by user
orderSchema.statics.findByUser = function (userId, limit = 10) {
  return this.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("items.book", "title images");
};

// Static method to get sales statistics
orderSchema.statics.getSalesStats = async function (startDate, endDate) {
  const matchStage = {
    paymentStatus: "COMPLETED",
    createdAt: { $gte: startDate, $lte: endDate },
  };

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$finalAmount" },
        totalOrders: { $sum: 1 },
        averageOrderValue: { $avg: "$finalAmount" },
      },
    },
  ]);
};

// Method to update order status
orderSchema.methods.updateStatus = function (newStatus, notes = "") {
  this.status = newStatus;
  this.notes = this.notes ? `${this.notes}\n${notes}` : notes;

  const now = new Date();
  if (newStatus === "DELIVERED") {
    this.deliveredAt = now;
  } else if (newStatus === "CANCELLED") {
    this.cancelledAt = now;
  }

  return this.save();
};

// Method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function () {
  const nonCancellableStatuses = ["SHIPPED", "DELIVERED", "CANCELLED"];
  return !nonCancellableStatuses.includes(this.status);
};

module.exports = mongoose.model("Order", orderSchema);
