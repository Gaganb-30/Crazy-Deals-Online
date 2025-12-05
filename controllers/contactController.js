// controllers/contactController.js
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");

dotenv.config();

/**
 * Send contact/support email
 */
const sendContactEmail = async (req, res) => {
  try {
    const { name, email, subject, message, phone } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email, subject, and message are required fields",
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.zoho.in",
      port: process.env.SMTP_PORT || 465,
      secure: true,
      auth: {
        user: process.env.SUPPORT_EMAIL, // support@domain_name.in
        pass: process.env.SUPPORT_EMAIL_PASSWORD, // App password for support email
      },
    });

    // Email content
    const mailOptions = {
      from: process.env.SUPPORT_EMAIL,
      to: process.env.SUPPORT_EMAIL, // Send to yourself
      replyTo: email, // So you can reply directly to the user
      subject: `Support Request: ${subject}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
                .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
                .field { margin-bottom: 15px; }
                .label { font-weight: bold; color: #555; }
                .value { color: #333; }
                .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>New Support Request</h1>
                </div>
                <div class="content">
                    <div class="field">
                        <span class="label">Name:</span>
                        <span class="value">${name}</span>
                    </div>
                    <div class="field">
                        <span class="label">Email:</span>
                        <span class="value">${email}</span>
                    </div>
                    ${
                      phone
                        ? `
                    <div class="field">
                        <span class="label">Phone:</span>
                        <span class="value">${phone}</span>
                    </div>
                    `
                        : ""
                    }
                    <div class="field">
                        <span class="label">Subject:</span>
                        <span class="value">${subject}</span>
                    </div>
                    <div class="field">
                        <span class="label">Message:</span>
                        <div class="value" style="margin-top: 10px; padding: 15px; background: white; border-radius: 5px; border: 1px solid #ddd;">
                            ${message.replace(/\n/g, "<br>")}
                        </div>
                    </div>
                </div>
                <div class="footer">
                    <p>This email was sent from your website contact form.</p>
                    <p>Received at: ${new Date().toLocaleString()}</p>
                </div>
            </div>
        </body>
        </html>
      `,
      text: `
New Support Request Received:

Name: ${name}
Email: ${email}
${phone ? `Phone: ${phone}` : ""}
Subject: ${subject}

Message:
${message}

---
This email was sent from your website contact form.
Received at: ${new Date().toLocaleString()}
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message:
        "Your message has been sent successfully. We will get back to you soon!",
    });
  } catch (error) {
    console.error("Send Contact Email Error:", error);

    // Handle specific email errors
    if (error.code === "EAUTH") {
      return res.status(500).json({
        success: false,
        message: "Email configuration error. Please contact administrator.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to send message. Please try again later.",
      error: error.message,
    });
  }
};

module.exports = {
  sendContactEmail,
};
