import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 }, // 12 Mo
  fileFilter: (req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(
      file.mimetype
    );
    if (ok) return cb(null, true);
    return cb(new Error("Format image invalide"));
  },
});

export default upload.single("image"); // champ = "image"
