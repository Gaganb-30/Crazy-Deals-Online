// models/Order.js
const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const orderItemSchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: [true, "Book reference is required"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
      // max: [10, "Cannot order more than 10 of a single book"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    title: {
      type: String,
      required: [true, "Book title is required"],
    },
    author: {
      type: String,
      required: [true, "Author is required"],
    },
    format: {
      type: String,
      enum: ["Paperback", "Hardcover"],
      default: "Paperback",
    },
  },
  {
    _id: true,
  }
);

const addressSchema = new mongoose.Schema({
  hNo: {
    type: String,
    required: [true, "House/Flat number is required"],
    trim: true,
  },
  street: {
    type: String,
    required: [true, "Street address is required"],
    trim: true,
  },
  city: {
    type: String,
    required: [true, "City is required"],
    trim: true,
  },
  state: {
    type: String,
    required: [true, "State is required"],
    trim: true,
  },
  zipCode: {
    type: String,
    required: [true, "ZIP code is required"],
    match: [/^\d{6}$/, "Please enter a valid 6-digit ZIP code"],
  },
  country: {
    type: String,
    default: "India",
    trim: true,
  },
});

const razorpaySchema = new mongoose.Schema({
  orderId: {
    type: String,
  },
  paymentId: {
    type: String,
  },
  signature: {
    type: String,
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      // required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
    items: [orderItemSchema],

    // Price breakdown - consistent with cart virtuals
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: [0, "Total amount cannot be negative"],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
    },
    deliveryCharge: {
      type: Number,
      default: 0,
      min: [0, "Delivery charge cannot be negative"],
    },
    finalAmount: {
      type: Number,
      required: [true, "Final amount is required"],
      min: [0, "Final amount cannot be negative"],
    },

    // Cart summary fields
    totalItems: {
      type: Number,
      required: [true, "Total items count is required"],
      min: [0, "Total items cannot be negative"],
    },
    totalWeight: {
      type: Number,
      default: 0,
      min: [0, "Total weight cannot be negative"],
    },
    savings: {
      type: Number,
      default: 0,
      min: [0, "Savings cannot be negative"],
    },
    // Add free delivery tracking
    freeDelivery: {
      type: Boolean,
      default: false,
    },
    freeDeliveryThreshold: {
      type: Number,
      default: 1500,
    },

    // Order status - Simplified for third-party delivery
    status: {
      type: String,
      enum: [
        "PENDING",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED", // Order handed to delivery partner
        "DELIVERED", // Marked when delivery partner confirms
        "CANCELLED",
        "REFUNDED",
      ],
      default: "PENDING",
      index: true,
    },

    // Payment information
    paymentMethod: {
      type: String,
      enum: ["RAZORPAY", "CASH_ON_DELIVERY", "CARD", "UPI", "WALLET"],
      required: [true, "Payment method is required"],
    },
    paymentStatus: {
      type: String,
      enum: [
        "PENDING",
        "COMPLETED",
        "FAILED",
        "REFUNDED",
        "REFUND_PENDING",
        "PARTIALLY_REFUNDED",
      ],
      default: "PENDING",
    },

    // Razorpay payment details
    razorpay: razorpaySchema,

    // Address information
    shippingAddress: {
      type: addressSchema,
      required: [true, "Shipping address is required"],
    },
    billingAddress: {
      type: addressSchema,
      required: [true, "Billing address is required"],
    },

    // Third-party delivery tracking - Simple redirect link
    deliveryTracking: {
      trackingLink: {
        type: String,
        sparse: true,
      },
      shippedAt: {
        type: Date,
      },
      deliveredAt: {
        type: Date,
      },
    },

    // Notes and timestamps
    notes: String,
    adminNotes: String,
    cancellationReason: String,
    cancelledAt: Date,
    refundedAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better query performance
orderSchema.index({ user: 1, createdAt: -1 }, { unique: true, sparse: true });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "razorpay.orderId": 1 }, { unique: true, sparse: true });
orderSchema.index({ "razorpay.paymentId": 1 }, { unique: true, sparse: true });
orderSchema.index({ orderNumber: "text" }, { unique: true, sparse: true });

// Pre-save middleware to generate order number and validate amounts
orderSchema.pre("save", async function (next) {
  if (this.isNew) {
    // Generate unique order number
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.orderNumber = `ORD${timestamp}${random}`;
    // Validate that final amount is calculated correctly
    if (
      this.isModified("totalAmount") ||
      this.isModified("discount") ||
      this.isModified("deliveryCharge")
    ) {
      this.finalAmount = this.totalAmount - this.discount + this.deliveryCharge;
    }

    // Validate that final amount is positive
    if (this.finalAmount < 0) {
      return next(new Error("Final amount cannot be negative"));
    }

    // Validate total items matches items array
    if (this.items && this.items.length > 0) {
      const calculatedTotalItems = this.items.reduce(
        (total, item) => total + item.quantity,
        0
      );
      if (this.totalItems !== calculatedTotalItems) {
        this.totalItems = calculatedTotalItems;
      }
    }
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

// Virtual for isPaid
orderSchema.virtual("isPaid").get(function () {
  return (
    this.paymentStatus === "COMPLETED" || this.paymentStatus === "REFUNDED"
  );
});

orderSchema.virtual("deliverySavings").get(function () {
  if (this.freeDelivery && this.deliveryCharge === 0) {
    // Calculate what delivery would have cost without free delivery
    const totalWeight = this.totalWeight;
    let originalDeliveryCharge = 0;

    if (totalWeight < 450) {
      originalDeliveryCharge = 50;
    } else if (totalWeight <= 1000) {
      originalDeliveryCharge = 80;
    } else if (totalWeight <= 2000) {
      originalDeliveryCharge = 120;
    } else {
      const additionalWeight = totalWeight - 2000;
      const additionalCharges = Math.ceil(additionalWeight / 500) * 40;
      originalDeliveryCharge = 120 + additionalCharges;
    }

    return originalDeliveryCharge;
  }
  return 0;
});

// Virtual for canBeModified - orders that can still be modified/cancelled
orderSchema.virtual("canBeModified").get(function () {
  return ["PENDING", "CONFIRMED", "PROCESSING"].includes(this.status);
});

// Virtual for delivery status
orderSchema.virtual("deliveryStatus").get(function () {
  if (this.status === "DELIVERED") return "Delivered";
  if (this.status === "SHIPPED") return "Shipped to Delivery Partner";
  if (this.status === "PROCESSING") return "Processing";
  if (this.status === "CANCELLED") return "Cancelled";
  return "Confirmed";
});

// Virtual for hasTracking - check if tracking link exists
orderSchema.virtual("hasTracking").get(function () {
  return !!(this.deliveryTracking && this.deliveryTracking.trackingLink);
});

// Static method to find orders by user with pagination
orderSchema.statics.findByUser = function (userId, page = 1, limit = 10) {
  return this.paginate(
    { user: userId },
    {
      page,
      limit,
      sort: { createdAt: -1 },
      populate: {
        path: "items.book",
        select: "title images format",
      },
    }
  );
};

// Static method to get sales statistics
orderSchema.statics.getSalesStats = async function (startDate, endDate) {
  const matchStage = {
    status: { $in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] },
    createdAt: { $gte: startDate, $lte: endDate },
  };

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$finalAmount" },
        totalOrders: { $sum: 1 },
        totalItemsSold: { $sum: "$totalItems" },
        averageOrderValue: { $avg: "$finalAmount" },
        minOrderValue: { $min: "$finalAmount" },
        maxOrderValue: { $max: "$finalAmount" },
      },
    },
  ]);

  return (
    stats[0] || {
      totalSales: 0,
      totalOrders: 0,
      totalItemsSold: 0,
      averageOrderValue: 0,
      minOrderValue: 0,
      maxOrderValue: 0,
    }
  );
};

// Method to update order status with validation
orderSchema.methods.updateStatus = function (
  newStatus,
  notes = "",
  isAdmin = false
) {
  const validTransitions = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["PROCESSING", "CANCELLED"],
    PROCESSING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED", "CANCELLED"],
    DELIVERED: ["REFUNDED"],
    CANCELLED: [],
    REFUNDED: [],
  };

  // Validate status transition
  if (!validTransitions[this.status].includes(newStatus)) {
    throw new Error(
      `Invalid status transition from ${this.status} to ${newStatus}`
    );
  }

  this.status = newStatus;

  // Add notes
  if (notes) {
    if (isAdmin) {
      this.adminNotes = this.adminNotes
        ? `${this.adminNotes}\n${notes}`
        : notes;
    } else {
      this.notes = this.notes ? `${this.notes}\n${notes}` : notes;
    }
  }

  // Update timestamps based on status
  const now = new Date();
  switch (newStatus) {
    case "SHIPPED":
      if (!this.deliveryTracking) {
        this.deliveryTracking = {};
      }
      this.deliveryTracking.shippedAt = now;
      break;
    case "DELIVERED":
      if (!this.deliveryTracking) {
        this.deliveryTracking = {};
      }
      this.deliveryTracking.deliveredAt = now;
      // Auto-complete COD payments on delivery
      if (
        this.paymentMethod === "CASH_ON_DELIVERY" &&
        this.paymentStatus === "PENDING"
      ) {
        this.paymentStatus = "COMPLETED";
      }
      break;
    case "CANCELLED":
      this.cancelledAt = now;
      // Update payment status for cancelled orders
      if (this.paymentStatus === "COMPLETED") {
        this.paymentStatus = "REFUND_PENDING";
      } else if (this.paymentStatus === "PENDING") {
        this.paymentStatus = "FAILED";
      }
      break;
    case "REFUNDED":
      this.refundedAt = now;
      this.paymentStatus = "REFUNDED";
      break;
  }

  return this.save();
};

// Method to add delivery tracking link (for admin)
orderSchema.methods.addTrackingLink = function (trackingLink) {
  if (!this.deliveryTracking) {
    this.deliveryTracking = {};
  }
  this.deliveryTracking.trackingLink = trackingLink;
  this.status = "SHIPPED";
  this.deliveryTracking.shippedAt = new Date();

  return this.save();
};

// Method to check if order can be cancelled
orderSchema.methods.canBeCancelled = function () {
  const nonCancellableStatuses = [
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
  ];
  return !nonCancellableStatuses.includes(this.status);
};

// Method to calculate refund amount
orderSchema.methods.getRefundAmount = function () {
  if (this.status !== "CANCELLED" && this.status !== "REFUNDED") {
    throw new Error(
      "Refund can only be calculated for cancelled or refunded orders"
    );
  }

  // For simplicity, refund the full amount for online payments
  // In reality, you might deduct shipping or other fees
  return this.finalAmount;
};

orderSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("Order", orderSchema);
