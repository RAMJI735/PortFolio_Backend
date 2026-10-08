import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  subject: { type: String, default: "No Subject", trim: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false }
}, {
  timestamps: true
});

export const Message = mongoose.models.Message || mongoose.model("Message", MessageSchema);
