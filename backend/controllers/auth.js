import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function signup(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email et mot de passe requis" });

    const hash = await bcrypt.hash(password, 10);
    await User.create({ email, password: hash });

    res.status(201).json({ message: "Utilisateur créé" });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: "Email déjà utilisé" });
    res.status(500).json({ message: "Erreur serveur" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(401).json({ message: "Identifiants invalides" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Identifiants invalides" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });
    res.json({ userId: user._id, token });
  } catch {
    res.status(500).json({ message: "Erreur serveur" });
  }
}
