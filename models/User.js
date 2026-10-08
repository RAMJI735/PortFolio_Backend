import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, trim: true },
  name: { type: String, default: "Deepanshu Srivastava" },
  password: { type: String, required: true },
  role: { type: String, default: "admin" }
}, {
  timestamps: true
});

export const User = mongoose.models.User || mongoose.model("User", UserSchema);
