import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

import { connectDB } from "./config/db.js";
import { storageService } from "./services/storageService.js";
import { wrapAsync } from "./utils/WrapAsync.js";
import authRoutes from "./routes/authRoutes.js";
import portfolioRoutes from "./routes/portfolioRoutes.js";
import contactRoutes, { handleContactSubmit } from "./routes/contactRoutes.js";

const app = express();
const PORT = process.env.PORT || 4000;

// Connect to MongoDB Atlas and initialize storage
connectDB().then(() => {
  storageService.init();
}).catch(err => {
  console.error("MongoDB start error:", err.message);
});

// CORS configuration - allow frontend dev server and production
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Request logger for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Root route
app.get("/", (req, res) => {
  res.json({
    name: "Portfolio Dynamic Backend API (MongoDB Connected)",
    status: "Active",
    version: "2.0.0",
    database: "MongoDB Atlas",
    endpoints: [
      "/api/portfolio",
      "/api/portfolio/skills",
      "/api/portfolio/experience",
      "/api/auth/login",
      "/api/contact",
      "/mail-send",
      "/api/health"
    ]
  });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Portfolio Dynamic Backend API is running smoothly!",
    database: storageService.isDbReady() ? "Connected to MongoDB Atlas" : "Local Cache Ready",
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Core Dynamic API routes
app.use("/api/auth", authRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/contact", contactRoutes);

// Direct /mail-send endpoint for backward compatibility
app.post("/mail-send", wrapAsync(handleContactSubmit));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error"
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Portfolio Backend running on http://localhost:${PORT}`);
  console.log(`📦 MongoDB Atlas dynamic CMS endpoints live`);
});

export default app;
