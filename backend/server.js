import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import bookRoutes from "./routes/books.js";
import auth from "./middleware/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middlewares globaux
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // autorise l'accès aux images depuis front
  })
);

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// Static (images optimisées par Sharp)
app.use(
  "/images",
  express.static(path.join(__dirname, "images"), {
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

// Routes API
app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);

// Healthcheck
app.get("/api/health", (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.json({ status: "ok", db: dbUp ? "up" : "down" });
});

// Route protégée de test
app.get("/api/me", auth, (req, res) => res.json(req.auth));

// Connexion DB + démarrage serveur
mongoose
  .set("strictQuery", true)
  .connect(process.env.MONGODB_URI, {})
  .then(() => {
    console.log("✅ MongoDB connected");
    app.listen(PORT, () =>
      console.log(`API running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => console.error("❌ MongoDB error:", err));
