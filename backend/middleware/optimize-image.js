import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imagesDir = path.join(__dirname, "..", "images");

export default async function optimizeImage(req, res, next) {
  try {
    if (!req.file)
      return res.status(400).json({ message: "Aucune image reçue" });

    await fs.mkdir(imagesDir, { recursive: true });

    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
    const outPath = path.join(imagesDir, filename);

    await sharp(req.file.buffer)
      .resize({ width: 450, height: 600, fit: "cover" }) // Green code: format compact et taille fixe
      .webp({ quality: 80 })
      .toFile(outPath);

    // On expose l'URL publique pour le front
    req.fileUrl = `${req.protocol}://${req.get("host")}/images/${filename}`;
    next();
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Erreur optimisation image" });
  }
}
