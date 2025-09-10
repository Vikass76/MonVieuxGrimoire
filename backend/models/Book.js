import mongoose from "mongoose";

const ratingSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    grade: { type: Number, required: true, min: 0, max: 5 },
  },
  { _id: false }
);

const bookSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true }, // créateur du livre
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    genre: { type: String, required: true, trim: true }, // <-- ajouté
    imageUrl: { type: String, required: true },
    ratings: { type: [ratingSchema], default: [] },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
  },
  { timestamps: true }
);

export default mongoose.model("Book", bookSchema);
