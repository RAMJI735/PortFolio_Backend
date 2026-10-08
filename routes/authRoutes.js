import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { storageService } from "../services/storageService.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "portfolio_super_secure_jwt_secret_key_2026";

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide both username/email and password."
      });
    }

    const user = await storageService.findUser(username.trim());
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials. User not found."
      });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials. Password incorrect."
      });
    }

    const payload = {
      id: user._id || user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

    return res.status(200).json({
      success: true,
      message: "Login successful!",
      token,
      user: payload
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during authentication."
    });
  }
});

// GET /api/auth/me (Protected)
router.get("/me", authenticateToken, async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user
  });
});

// POST /api/auth/change-password (Protected)
router.post("/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Both current password and new password are required."
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long."
      });
    }

    const user = await storageService.findUser(req.user.username);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const isMatch = bcrypt.compareSync(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password does not match."
      });
    }

    await storageService.updateUserPassword(user.username, newPassword);

    return res.status(200).json({
      success: true,
      message: "Password updated successfully!"
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update password."
    });
  }
});

export default router;
