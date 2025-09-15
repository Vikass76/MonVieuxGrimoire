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

/** Active Multer + Sharp uniquement si la requête est multipart */
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
    const { title, author, year, genre } = payload;

    const parsedYear = Number(year);
    if (
      !title ||
      !author ||
      !year ||
      !genre ||
      !req.fileUrl ||
      !Number.isFinite(parsedYear)
    ) {
      return res
        .status(400)
        .json({ message: "title, author, year, genre, image requis" });
    }

    const doc = await Book.create({
      userId: String(req.auth.userId),
      title: String(title).trim(),
      author: String(author).trim(),
      year: parsedYear,
      genre: String(genre).trim(),
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

    if (String(book.userId) !== String(req.auth.userId)) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    const src = req.body.book ? JSON.parse(req.body.book) : req.body;
    const { title, author, year, genre } = src || {};
    const parsedYear = Number(year);

    if (!title || !author || !year || !genre || !Number.isFinite(parsedYear)) {
      return res
        .status(400)
        .json({ message: "title, author, year, genre requis" });
    }

    book.title = String(title).trim();
    book.author = String(author).trim();
    book.year = parsedYear;
    book.genre = String(genre).trim();

    // si nouvelle image, supprimer l’ancienne
    if (req.fileUrl) {
      const oldPart = (book.imageUrl || "").split("/images/")[1];
      if (oldPart) {
        try {
          await fs.unlink(path.join(imagesDir, oldPart));
        } catch {}
      }
      book.imageUrl = req.fileUrl;
    }

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

    if (String(book.userId) !== String(req.auth.userId)) {
      return res.status(403).json({ message: "Non autorisé" });
    }

    const part = (book.imageUrl || "").split("/images/")[1];
    if (part) {
      try {
        await fs.unlink(path.join(imagesDir, part));
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
    // ID manquant/incorrect
    if (!req.params.id || req.params.id === "undefined") {
      return res.status(400).json({ message: "ID livre manquant", book: null });
    }

    // Récup livre
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: "Livre introuvable", book: null });
    }

    // Auteur ne peut pas noter
    if (String(book.userId) === String(req.auth.userId)) {
      return res
        .status(403)
        .json({ message: "Impossible de noter son propre livre", book });
    }

    // Vérif note
    const g = Number(req.body.grade ?? req.body.rating);
    if (!Number.isFinite(g) || g < 0 || g > 5) {
      return res
        .status(400)
        .json({ message: "La note doit être entre 0 et 5", book });
    }

    // Un seul vote / user
    if (
      book.ratings.some((r) => String(r.userId) === String(req.auth.userId))
    ) {
      return res
        .status(400)
        .json({ message: "Vous avez déjà noté ce livre", book });
    }

    // Ajout de la note + moyenne
    book.ratings.push({ userId: String(req.auth.userId), grade: g });
    const sum = book.ratings.reduce((s, r) => s + r.grade, 0);
    book.averageRating = Math.round((sum / book.ratings.length) * 10) / 10;

    const saved = await book.save();
    return res.status(201).json(saved);
  } catch (e) {
    console.error("Rating error:", e);
    return res.status(400).json({ message: "Requête invalide", book: null });
  }
});

export default router;
