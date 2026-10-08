import mongoose from "mongoose";

const SkillItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  percentage: { type: String, default: "80" }
}, { _id: false });

const WorkExperienceSchema = new mongoose.Schema({
  role: { type: String, required: true },
  year: { type: String, default: "" },
  company: { type: String, required: true },
  points: { type: [String], default: [] }
}, { _id: false });

const EducationSchema = new mongoose.Schema({
  degree: { type: String, required: true },
  year: { type: String, default: "" },
  university: { type: String, default: "" },
  details: { type: String, default: "" }
}, { _id: false });

const ServiceItemSchema = new mongoose.Schema({
  id: { type: String },
  title: { type: String, required: true },
  description: { type: String, default: "" },
  image: { type: String, default: "frontend.jpg" }
}, { _id: false });

const PortfolioSchema = new mongoose.Schema({
  slug: { type: String, default: "main", unique: true },
  profile: {
    name: { type: String, default: "Deepanshu Srivastava" },
    avatar: { type: String, default: "/assets/side.jpeg" },
    profession: { type: String, default: "Full Stack Developer" }
  },
  navigation: [{
    id: String,
    label: String
  }],
  sections: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  strict: false
});

export const Portfolio = mongoose.models.Portfolio || mongoose.model("Portfolio", PortfolioSchema);
