// models/Cart.js
const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
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
      max: [10, "Cannot add more than 10 of the same book"],
    },
    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },
    weight: {
      type: Number, // in grams
      required: true,
      min: [1, "Weight must be positive"],
    },
  },
  {
    _id: true,
    timestamps: true,
  }
);

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [cartItemSchema],
    coupon: {
      code: String,
      discount: {
        type: Number,
        min: [0, "Discount cannot be negative"],
        max: [100, "Discount cannot exceed 100%"],
      },
      discountType: {
        type: String,
        enum: ["percentage", "fixed"],
        default: "percentage",
      },
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better performance
// cartSchema.index({ user: 1 });
cartSchema.index({ "items.book": 1 });

// Virtual for total weight
cartSchema.virtual("totalWeight").get(function () {
  if (!this.items || this.items.length === 0) return 0;

  return this.items.reduce((total, item) => {
    // If book is populated and has weight, use it, otherwise assume default
    const itemWeight = item.book?.weight || 300; // default 300g per book
    return total + itemWeight * item.quantity;
  }, 0);
});

// Virtual for delivery charge
cartSchema.virtual("deliveryCharge").get(function () {
  const totalWeight = this.totalWeight;

  if (totalWeight <= 0) return 0;

  // Delivery charge rules
  if (totalWeight < 450) {
    return 50;
  } else if (totalWeight <= 1000) {
    // 1kg = 1000g
    return 80;
  } else if (totalWeight <= 2000) {
    // 2kg = 2000g
    return 120;
  } else {
    // For weights above 2kg, you can add additional logic
    // For now, let's charge 120 + 40 for every additional 500g
    const additionalWeight = totalWeight - 2000;
    const additionalCharges = Math.ceil(additionalWeight / 500) * 40;
    return 120 + additionalCharges;
  }
});

// Virtual for total price
cartSchema.virtual("totalPrice").get(function () {
  return this.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
});

// Virtual for final total (items total + delivery)
cartSchema.virtual("finalTotal").get(function () {
  const itemsTotal = this.discountedPrice || this.totalPrice;
  return itemsTotal + this.deliveryCharge;
});

// Method to calculate delivery charge (for use in controllers)
cartSchema.methods.calculateDeliveryCharge = function (totalWeight) {
  if (totalWeight <= 0) return 0;

  if (totalWeight < 450) {
    return 50;
  } else if (totalWeight <= 1000) {
    return 80;
  } else if (totalWeight <= 2000) {
    return 120;
  } else {
    const additionalWeight = totalWeight - 2000;
    const additionalCharges = Math.ceil(additionalWeight / 500) * 40;
    return 120 + additionalCharges;
  }
};

// Virtual for total items count
cartSchema.virtual("totalItems").get(function () {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

// Virtual for discounted price
cartSchema.virtual("discountedPrice").get(function () {
  const total = this.totalPrice;
  if (this.coupon && this.coupon.discount) {
    if (this.coupon.discountType === "percentage") {
      return total - (total * this.coupon.discount) / 100;
    } else {
      return Math.max(0, total - this.coupon.discount);
    }
  }
  return total;
});

// Virtual for savings amount
cartSchema.virtual("savings").get(function () {
  return this.totalPrice - this.discountedPrice;
});

// Method to add item to cart with price validation
cartSchema.methods.addItem = async function (bookId, quantity = 1) {
  try {
    // Get current book price
    const Book = mongoose.model("Book");
    const book = await Book.findById(bookId).select("price available stock");

    if (!book) {
      throw new Error("Book not found");
    }

    if (!book.available) {
      throw new Error("Book is not available");
    }

    if (book.stock < quantity) {
      throw new Error(`Only ${book.stock} items available in stock`);
    }

    const existingItem = this.items.find(
      (item) => item.book.toString() === bookId.toString()
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity > 10) {
        throw new Error("Cannot add more than 10 of the same book");
      }
      if (newQuantity > book.stock) {
        throw new Error(`Only ${book.stock} items available in stock`);
      }
      existingItem.quantity = newQuantity;
      existingItem.price = book.price; // Update price in case it changed
    } else {
      if (quantity > book.stock) {
        throw new Error(`Only ${book.stock} items available in stock`);
      }
      this.items.push({
        book: bookId,
        quantity,
        price: book.price,
      });
    }

    this.lastUpdated = new Date();
    return this.save();
  } catch (error) {
    throw error;
  }
};

// Method to remove item from cart
cartSchema.methods.removeItem = function (bookId) {
  this.items = this.items.filter(
    (item) => item.book.toString() !== bookId.toString()
  );
  this.lastUpdated = new Date();
  return this.save();
};

// Method to update item quantity
cartSchema.methods.updateQuantity = async function (bookId, quantity) {
  try {
    if (quantity <= 0) {
      return this.removeItem(bookId);
    }

    if (quantity > 10) {
      throw new Error("Cannot add more than 10 of the same book");
    }

    // Check stock availability
    const Book = mongoose.model("Book");
    const book = await Book.findById(bookId).select("stock");

    if (!book) {
      throw new Error("Book not found");
    }

    if (quantity > book.stock) {
      throw new Error(`Only ${book.stock} items available in stock`);
    }

    const item = this.items.find(
      (item) => item.book.toString() === bookId.toString()
    );
    if (item) {
      item.quantity = quantity;
      this.lastUpdated = new Date();
    }

    return this.save();
  } catch (error) {
    throw error;
  }
};

// Method to clear cart
cartSchema.methods.clear = function () {
  this.items = [];
  this.coupon = undefined;
  this.lastUpdated = new Date();
  return this.save();
};

// Method to apply coupon
cartSchema.methods.applyCoupon = function (
  couponCode,
  discount,
  discountType = "percentage"
) {
  this.coupon = {
    code: couponCode,
    discount: discount,
    discountType: discountType,
  };
  this.lastUpdated = new Date();
  return this.save();
};

// Method to remove coupon
cartSchema.methods.removeCoupon = function () {
  this.coupon = undefined;
  this.lastUpdated = new Date();
  return this.save();
};

// Static method to get cart by user ID with populated items
cartSchema.statics.findByUser = function (userId) {
  return this.findOne({ user: userId }).populate({
    path: "items.book",
    select: "id title author price available stock format images",
  });
};

// Pre-save middleware to update lastUpdated
cartSchema.pre("save", function (next) {
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model("Cart", cartSchema);
