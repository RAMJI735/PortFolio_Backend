import express from "express";
import { storageService } from "../services/storageService.js";
import { authenticateToken } from "../middleware/auth.js";
import nodemailer from "nodemailer";

const router = express.Router();

// Helper to send email via Nodemailer
async function trySendEmailNotification(inquiry) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ADMIN_EMAIL, RECEIVER_EMAIL } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return false;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });

    const recipient = RECEIVER_EMAIL || ADMIN_EMAIL || SMTP_USER;

    await transporter.sendMail({
      from: `"${inquiry.name} via Portfolio" <${SMTP_USER}>`,
      to: recipient,
      replyTo: inquiry.email,
      subject: `[Portfolio Inquiry] ${inquiry.subject || "New Message"} - from ${inquiry.name}`,
      text: `
Name: ${inquiry.name}
Email: ${inquiry.email}
Subject: ${inquiry.subject || "Portfolio Contact"}
Message: ${inquiry.message}
      `,
      html: `
        <div style="font-family: sans-serif; padding: 20px; line-height: 1.6; max-width: 600px; margin: auto; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #2563eb; margin-top: 0;">New Portfolio Contact Message</h2>
          <p><strong>Name:</strong> ${inquiry.name}</p>
          <p><strong>Email:</strong> <a href="mailto:${inquiry.email}">${inquiry.email}</a></p>
          <p><strong>Subject:</strong> ${inquiry.subject || "N/A"}</p>
          <div style="margin-top: 15px; padding: 15px; background: #f3f4f6; border-radius: 8px;">
            <p style="margin: 0; white-space: pre-wrap;">${inquiry.message}</p>
          </div>
        </div>
      `
    });
    return true;
  } catch (err) {
    console.error("Nodemailer delivery error:", err.message);
    return false;
  }
}

// POST /api/contact and legacy /mail-send handler
export const handleContactSubmit = async (req, res) => {
  console.log('[handleContactSubmit] Received contact submission:', req.body);
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, Email and Message required!"
      });
    }

    // Save inquiry to MongoDB storage
    const saved = await storageService.addMessage({ name, email, subject: subject || "Portfolio Message", message });

    // Try sending email via nodemailer
    trySendEmailNotification(saved).catch(err => console.error("Email send async err:", err));

    return res.status(200).json({
      status: 200,
      success: true,
      message: "Message sent successfully!",
      data: saved
    });
  } catch (error) {
    console.error("Contact form error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong while sending the message!"
    });
  }
};

router.post("/", handleContactSubmit);

// GET /api/contact/messages - Protected
router.get("/messages", authenticateToken, async (req, res) => {
  try {
    const messages = await storageService.getMessages();
    return res.status(200).json({
      success: true,
      messages
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to retrieve messages." });
  }
});

// PATCH /api/contact/messages/:id/read - Protected
router.patch("/messages/:id/read", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { isRead } = req.body;
    const updated = await storageService.markMessageRead(id, isRead !== undefined ? isRead : true);
    if (!updated) {
      return res.status(404).json({ success: false, message: "Message not found." });
    }
    return res.status(200).json({ success: true, message: "Message status updated.", data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/contact/messages/:id - Protected
router.delete("/messages/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await storageService.deleteMessage(id);
    return res.status(200).json({
      success: true,
      message: "Message deleted successfully.",
      ...result
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
