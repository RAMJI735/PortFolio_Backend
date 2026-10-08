import mongoose from "mongoose";

let isConnected = false;

export const connectDB = async () => {
  const uri = process.env.MONGO_URI || "mongodb+srv://dipanshusrivastava735:deepanshu123@cluster0.j0x2swe.mongodb.net/PortfolioDB?retryWrites=true&w=majority";

  if (isConnected) {
    return;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });
    isConnected = true;
    console.log(`🍃 MongoDB Connected: ${conn.connection.host} / DB: ${conn.connection.name}`);
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error.message);
  }
};

mongoose.connection.on("disconnected", () => {
  isConnected = false;
  console.warn("⚠️ MongoDB Disconnected. Reconnecting...");
});

mongoose.connection.on("error", (err) => {
  console.error("⚠️ MongoDB connection error event:", err.message);
});
