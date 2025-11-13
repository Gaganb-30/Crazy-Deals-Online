const nodemailer = require("nodemailer");

// Create transporter with Hostinger SMTP settings
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.hostinger.com",
    port: process.env.EMAIL_PORT || 465,
    secure: true, // Use SSL
    auth: {
      user: process.env.EMAIL_USER, // Your Hostinger domain email
      pass: process.env.EMAIL_PASS, // Your Hostinger email password
    },
  });
};

// Email templates
const emailTemplates = {
  orderPlaced: (order, user) => ({
    subject: `🎉 Order Confirmed - ${order.orderNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .item { border-bottom: 1px solid #eee; padding: 10px 0; }
          .total { font-size: 18px; font-weight: bold; color: #2d3748; }
          .status { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
          .status-confirmed { background: #c6f6d5; color: #22543d; }
          .footer { text-align: center; margin-top: 30px; color: #718096; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Order Confirmed!</h1>
            <p>Thank you for your purchase, ${user.name}!</p>
          </div>
          <div class="content">
            <h2>Order Details</h2>
            <div class="order-details">
              <p><strong>Order Number:</strong> ${order.orderNumber}</p>
              <p><strong>Order Date:</strong> ${new Date(
                order.createdAt
              ).toLocaleDateString()}</p>
              <p><strong>Status:</strong> <span class="status status-confirmed">${
                order.status
              }</span></p>
              <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
              
              <h3>Items Ordered:</h3>
              ${order.items
                .map(
                  (item) => `
                <div class="item">
                  <p><strong>${item.title}</strong> by ${item.author}</p>
                  <p>Quantity: ${item.quantity} × ₹${item.price} = ₹${(
                    item.quantity * item.price
                  ).toFixed(2)}</p>
                </div>
              `
                )
                .join("")}
              
              <div style="border-top: 2px solid #e2e8f0; margin-top: 20px; padding-top: 15px;">
                <p><strong>Subtotal:</strong> ₹${order.totalAmount.toFixed(
                  2
                )}</p>
                ${
                  order.discount > 0
                    ? `<p><strong>Discount:</strong> -₹${order.discount.toFixed(
                        2
                      )}</p>`
                    : ""
                }
                <p><strong>Shipping:</strong> ₹${order.deliveryCharge.toFixed(
                  2
                )}</p>
                <p class="total">Total: ₹${order.finalAmount.toFixed(2)}</p>
              </div>
            </div>
            
            <h3>Shipping Address</h3>
            <div class="order-details">
              <p>${user.name}</p>
              <p>${order.shippingAddress.hNo}, ${
      order.shippingAddress.street
    }</p>
              <p>${order.shippingAddress.city}, ${
      order.shippingAddress.state
    } - ${order.shippingAddress.zipCode}</p>
              <p>${order.shippingAddress.country}</p>
            </div>
            
            <p>We'll send you a confirmation when your order ships.</p>
            <p>You can track your order anytime from your account.</p>
          </div>
          <div class="footer">
            <p>If you have any questions, please visit our help center.</p>
            <p>© ${new Date().getFullYear()} Crazy Deals Online. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  orderCancelled: (order, user) => ({
    subject: `❌ Order Cancelled - ${order.orderNumber}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #fc8181 0%, #f56565 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .order-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .item { border-bottom: 1px solid #eee; padding: 10px 0; }
          .status { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
          .status-cancelled { background: #fed7d7; color: #742a2a; }
          .footer { text-align: center; margin-top: 30px; color: #718096; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Order Cancelled</h1>
            <p>Your order has been cancelled</p>
          </div>
          <div class="content">
            <h2>Cancelled Order Details</h2>
            <div class="order-details">
              <p><strong>Order Number:</strong> ${order.orderNumber}</p>
              <p><strong>Order Date:</strong> ${new Date(
                order.createdAt
              ).toLocaleDateString()}</p>
              <p><strong>Cancelled Date:</strong> ${new Date(
                order.cancelledAt
              ).toLocaleDateString()}</p>
              <p><strong>Status:</strong> <span class="status status-cancelled">${
                order.status
              }</span></p>
              <p><strong>Cancellation Reason:</strong> ${
                order.cancellationReason || "Not specified"
              }</p>
              
              <h3>Items in Cancelled Order:</h3>
              ${order.items
                .map(
                  (item) => `
                <div class="item">
                  <p><strong>${item.title}</strong> by ${item.author}</p>
                  <p>Quantity: ${item.quantity} × ₹${item.price}</p>
                </div>
              `
                )
                .join("")}
              
              <p><strong>Order Total:</strong> ₹${order.finalAmount.toFixed(
                2
              )}</p>
            </div>
            
            <p>If this cancellation was a mistake or you need help, please contact our support team.</p>
            <p>We hope to see you again soon!</p>
          </div>
          <div class="footer">
            <p>If you have any questions, please visit our help center.</p>
            <p>© ${new Date().getFullYear()} Crazy Deals Online. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),

  adminNotification: (order, user, type) => ({
    subject: `📦 ${type === "placed" ? "New Order" : "Order Cancelled"} - ${
      order.orderNumber
    }`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4fd1c7 0%, #319795 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
          .order-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .alert { background: #fffaf0; border-left: 4px solid #dd6b20; padding: 15px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${
              type === "placed" ? "📦 New Order Received" : "❌ Order Cancelled"
            }</h1>
          </div>
          <div class="content">
            <div class="alert">
              <strong>Action Required:</strong> ${
                type === "placed"
                  ? "New order needs processing"
                  : "Order has been cancelled"
              }
            </div>
            
            <h2>Order Summary</h2>
            <div class="order-details">
              <p><strong>Order Number:</strong> ${order.orderNumber}</p>
              <p><strong>Customer:</strong> ${user.name} (${user.email})</p>
              <p><strong>Phone:</strong> ${user.phone || "Not provided"}</p>
              <p><strong>Amount:</strong> ₹${order.finalAmount.toFixed(2)}</p>
              <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
              <p><strong>Status:</strong> ${order.status}</p>
              ${
                type === "cancelled"
                  ? `<p><strong>Cancellation Reason:</strong> ${
                      order.cancellationReason || "Not specified"
                    }</p>`
                  : ""
              }
              
              <h3>Items (${order.items.length}):</h3>
              <ul>
                ${order.items
                  .map(
                    (item) => `
                  <li>${item.title} - Qty: ${item.quantity} × ₹${item.price}</li>
                `
                  )
                  .join("")}
              </ul>
            </div>
            
            <h3>Shipping Address</h3>
            <div class="order-details">
              <p>${order.shippingAddress.hNo}, ${
      order.shippingAddress.street
    }</p>
              <p>${order.shippingAddress.city}, ${
      order.shippingAddress.state
    } - ${order.shippingAddress.zipCode}</p>
            </div>
            
            <p><em>This is an automated notification. Please do not reply to this email.</em></p>
          </div>
        </div>
      </body>
      </html>
    `,
  }),
};

// Send email function
const sendEmail = async (to, subject, html) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: {
        name: "Crazy Deals Online",
        address: process.env.EMAIL_USER,
      },
      to,
      subject,
      html,
      replyTo: "support@crazydealonline.com", // Set to no-reply as requested
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: error.message };
  }
};

// Send order notification to customer and admin
const sendOrderNotification = async (order, user, type) => {
  try {
    // Get the appropriate email template
    const customerTemplate =
      type === "placed"
        ? emailTemplates.orderPlaced(order, user)
        : emailTemplates.orderCancelled(order, user);

    const adminTemplate = emailTemplates.adminNotification(order, user, type);

    // Send to customer
    const customerResult = await sendEmail(
      user.email,
      customerTemplate.subject,
      customerTemplate.html
    );

    // Send to admin (your personal email)
    const adminResult = await sendEmail(
      process.env.ADMIN_EMAIL, // Your personal email from environment variables
      adminTemplate.subject,
      adminTemplate.html
    );

    return {
      customer: customerResult,
      admin: adminResult,
    };
  } catch (error) {
    console.error("Error sending order notification:", error);
    return { error: error.message };
  }
};

module.exports = {
  sendEmail,
  sendOrderNotification,
  emailTemplates,
};
