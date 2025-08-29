import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import auth from "./middleware/auth.js";
import bookRoutes from "./routes/books.js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connexion MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {})
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

app.use(express.json());
app.use("/api/books", bookRoutes);
app.use("/images", express.static(path.join(__dirname, "images")));

// Routes
app.use("/api/auth", authRoutes);

// Healthcheck
app.get("/api/health", (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.json({ status: "ok", db: dbUp ? "up" : "down" });
});

// Route protégée (test)
app.get("/api/me", auth, (req, res) => {
  res.json(req.auth);
});

// Lancement serveur
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
