import { Router } from "express";
import Book from "../models/Book.js";
import auth from "../middleware/auth.js";
import upload from "../middleware/multer-config.js";
import optimizeImage from "../middleware/optimize-image.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imagesDir = path.join(__dirname, "..", "images");

const router = Router();

/** N’active Multer + Sharp que si la requête est multipart */
function maybeUpload(req, res, next) {
  const ct = (req.headers["content-type"] || "").toLowerCase();
  if (ct.startsWith("multipart/form-data")) {
    return upload(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.message });
      return optimizeImage(req, res, next);
    });
  }
  return next();
}

/* -------------------- LISTE -------------------- */
router.get("/", async (_req, res) => {
  const books = await Book.find().lean();
  res.json(books);
});

/* ----------- TOP 3 MEILLEURES NOTES ------------ */
/* (placé avant '/:id' pour ne PAS être capturé par ':id') */
router.get("/bestrating", async (_req, res) => {
  const books = await Book.find().sort({ averageRating: -1 }).limit(3).lean();
  res.json(books);
});

/* --------------------- DÉTAIL ------------------- */
router.get("/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id).lean();
    if (!book) return res.status(404).json({ message: "Livre introuvable" });
    res.json(book);
  } catch {
    res.status(400).json({ message: "ID invalide" });
  }
});

/* -------------------- CRÉATION ------------------ */
/* multipart: champ 'book' (JSON) + champ 'image' (fichier) */
router.post("/", auth, upload, optimizeImage, async (req, res) => {
  try {
    const payload = JSON.parse(req.body.book || "{}");
    const { title, author, year } = payload;
    if (!title || !author || !year || !req.fileUrl) {
      return res
        .status(400)
        .json({ message: "title, author, year, image requis" });
    }
    const doc = await Book.create({
      userId: req.auth.userId,
      title,
      author,
      year: Number(year),
      imageUrl: req.fileUrl,
      ratings: [],
      averageRating: 0,
    });
    res.status(201).json(doc);
  } catch {
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ------------------ MODIFICATION ---------------- */
/* owner only, image optionnelle (via maybeUpload) */
router.put("/:id", auth, maybeUpload, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Livre introuvable" });
    if (book.userId !== req.auth.userId) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    const src = req.body.book ? JSON.parse(req.body.book) : req.body;
    const { title, author, year } = src || {};
    if (!title || !author || !year) {
      return res.status(400).json({ message: "title, author, year requis" });
    }

    book.title = title;
    book.author = author;
    book.year = Number(year);
    if (req.fileUrl) book.imageUrl = req.fileUrl;

    const saved = await book.save();
    res.json(saved);
  } catch {
    res.status(400).json({ message: "Requête invalide" });
  }
});

/* ------------------- SUPPRESSION ---------------- */
/* owner only + supprime le fichier image */
router.delete("/:id", auth, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Livre introuvable" });
    if (book.userId !== req.auth.userId) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    const part = (book.imageUrl || "").split("/images/")[1];
    if (part) {
      const filePath = path.join(imagesDir, part);
      try {
        await fs.unlink(filePath);
      } catch {}
    }

    await book.deleteOne({ _id: book._id });
    res.json({ message: "Livre supprimé" });
  } catch {
    res.status(400).json({ message: "Requête invalide" });
  }
});

/* -------------------- NOTATION ------------------ */
/* 1 note/user, 0..5, interdit de noter son propre livre */
router.post("/:id/rating", auth, async (req, res) => {
  try {
    const g = Number(req.body.grade ?? req.body.rating);
    if (!Number.isFinite(g) || g < 0 || g > 5) {
      return res
        .status(400)
        .json({ message: "La note doit être entre 0 et 5" });
    }

    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: "Livre introuvable" });

    if (book.userId === req.auth.userId) {
      return res
        .status(403)
        .json({ message: "Impossible de noter son propre livre" });
    }
    if (book.ratings.some((r) => r.userId === req.auth.userId)) {
      return res.status(400).json({ message: "Vous avez déjà noté ce livre" });
    }

    book.ratings.push({ userId: req.auth.userId, grade: g });
    const sum = book.ratings.reduce((s, r) => s + r.grade, 0);
    book.averageRating = Math.round((sum / book.ratings.length) * 10) / 10;

    await book.save();
    res.status(201).json(book);
  } catch {
    res.status(400).json({ message: "Requête invalide" });
  }
});

export default router;
