import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { defaultPortfolioData } from "../data/defaultPortfolio.js";
import { Portfolio } from "../models/Portfolio.js";
import { User } from "../models/User.js";
import { Message } from "../models/Message.js";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../data");

const PORTFOLIO_FILE = path.join(DATA_DIR, "portfolio.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonFile(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), "utf8");
      return defaultValue;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    return defaultValue;
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (error) {
    return false;
  }
}

class StorageService {
  constructor() {
    this.memoryCache = null;
  }

  isDbReady() {
    return mongoose.connection.readyState === 1;
  }

  async init() {
    try {
      if (!fs.existsSync(PORTFOLIO_FILE)) {
        writeJsonFile(PORTFOLIO_FILE, defaultPortfolioData);
      }

      if (this.isDbReady()) {
        await this.syncDatabase();
      }
    } catch (err) {
      console.error("StorageService init error:", err.message);
    }
  }

  async syncDatabase() {
    try {
      let dbPortfolio = await Portfolio.findOne({ slug: "main" });
      if (!dbPortfolio) {
        console.log("🌱 Seeding Portfolio into MongoDB Atlas...");
        const localData = readJsonFile(PORTFOLIO_FILE, defaultPortfolioData);
        dbPortfolio = await Portfolio.create({
          slug: "main",
          profile: localData.profile,
          navigation: localData.navigation,
          sections: localData.sections
        });
        console.log("✅ Portfolio seeded into MongoDB Atlas successfully!");
      } else {
        // Ensure projects section exists if not already present
        if (!dbPortfolio.sections?.projects) {
          console.log("🌱 Adding projects section to existing Portfolio document...");
          if (!dbPortfolio.sections) dbPortfolio.sections = {};
          dbPortfolio.sections.projects = defaultPortfolioData.sections.projects;
          dbPortfolio.markModified("sections");
          await dbPortfolio.save();
        }
      }

      const defaultUsername = process.env.ADMIN_USERNAME || "admin";
      const defaultEmail = process.env.ADMIN_EMAIL || "dipanshusrivastava.735@gmail.com";
      const defaultPass = process.env.ADMIN_PASSWORD || "admin123";

      let adminUser = await User.findOne({
        $or: [{ username: defaultUsername }, { email: defaultEmail }]
      });

      if (!adminUser) {
        console.log("🌱 Seeding Admin User into MongoDB Atlas...");
        const hashedPassword = bcrypt.hashSync(defaultPass, 10);
        await User.create({
          username: defaultUsername,
          email: defaultEmail,
          name: "Deepanshu Srivastava",
          password: hashedPassword,
          role: "admin"
        });
        console.log("✅ Admin User seeded into MongoDB Atlas!");
      }
    } catch (err) {
      console.error("Database sync error:", err.message);
    }
  }

  // --- Portfolio Operations ---

  async getPortfolio() {
    if (this.isDbReady()) {
      try {
        let doc = await Portfolio.findOne({ slug: "main" }).lean();
        if (!doc) {
          const seeded = await Portfolio.create({
            slug: "main",
            ...defaultPortfolioData
          });
          doc = seeded.toObject();
        }
        // If projects section is missing in old DB doc, attach default
        if (!doc.sections?.projects) {
          doc.sections = {
            ...doc.sections,
            projects: defaultPortfolioData.sections.projects
          };
          await Portfolio.updateOne(
            { slug: "main" },
            { $set: { "sections.projects": defaultPortfolioData.sections.projects } }
          );
        }
        writeJsonFile(PORTFOLIO_FILE, doc);
        return doc;
      } catch (err) {
        console.error("DB getPortfolio failed, falling back to cache:", err.message);
      }
    }
    return readJsonFile(PORTFOLIO_FILE, defaultPortfolioData);
  }

  async updatePortfolio(updatedData) {
    const current = await this.getPortfolio();
    const merged = {
      ...current,
      ...updatedData,
      sections: {
        ...(current.sections || {}),
        ...(updatedData.sections || {})
      }
    };

    writeJsonFile(PORTFOLIO_FILE, merged);

    if (this.isDbReady()) {
      try {
        const doc = await Portfolio.findOneAndUpdate(
          { slug: "main" },
          {
            $set: {
              profile: merged.profile,
              navigation: merged.navigation,
              sections: merged.sections
            }
          },
          { new: true, upsert: true }
        ).lean();
        return doc;
      } catch (err) {
        console.error("DB updatePortfolio error:", err.message);
      }
    }
    return merged;
  }

  async updateSection(sectionName, sectionData) {
    const current = await this.getPortfolio();
    if (!current.sections) {
      current.sections = {};
    }
    current.sections[sectionName] = sectionData;
    writeJsonFile(PORTFOLIO_FILE, current);

    if (this.isDbReady()) {
      try {
        const updateQuery = {};
        if (sectionName === "profile" || sectionName === "navigation") {
          updateQuery[sectionName] = sectionData;
        } else {
          updateQuery[`sections.${sectionName}`] = sectionData;
        }

        const doc = await Portfolio.findOneAndUpdate(
          { slug: "main" },
          { $set: updateQuery },
          { new: true, upsert: true }
        ).lean();
        return doc;
      } catch (err) {
        console.error(`DB updateSection [${sectionName}] error:`, err.message);
      }
    }
    return current;
  }

  // Skills helpers
  async updateSkills(skillsArray) {
    const current = await this.getPortfolio();
    if (!current.sections) current.sections = {};
    if (!current.sections.about) current.sections.about = {};
    if (!current.sections.about.skills) current.sections.about.skills = { title: "Skills", content: [] };

    current.sections.about.skills.content = skillsArray;
    return await this.updateSection("about", current.sections.about);
  }

  // Work Experience helpers
  async updateExperience(experienceArray) {
    const current = await this.getPortfolio();
    if (!current.sections) current.sections = {};
    if (!current.sections.resume) current.sections.resume = { title: "Resume", experience: [] };

    current.sections.resume.experience = experienceArray;
    return await this.updateSection("resume", current.sections.resume);
  }

  // Projects helpers
  async updateProjects(projectsData) {
    return await this.updateSection("projects", projectsData);
  }

  async toggleProjects(enabled) {
    const current = await this.getPortfolio();
    if (!current.sections) current.sections = {};
    if (!current.sections.projects) {
      current.sections.projects = defaultPortfolioData.sections.projects;
    }
    current.sections.projects.enabled = enabled !== undefined ? enabled : !current.sections.projects.enabled;
    return await this.updateSection("projects", current.sections.projects);
  }

  async addProject(projectItem) {
    const current = await this.getPortfolio();
    if (!current.sections) current.sections = {};
    if (!current.sections.projects) {
      current.sections.projects = { title: "Featured Projects", enabled: true, list: [] };
    }
    if (!Array.isArray(current.sections.projects.list)) {
      current.sections.projects.list = [];
    }

    const newProject = {
      id: "proj-" + Date.now(),
      title: projectItem.title || "New Project",
      description: projectItem.description || "",
      image: projectItem.image || "",
      technologies: Array.isArray(projectItem.technologies)
        ? projectItem.technologies
        : typeof projectItem.technologies === "string"
        ? projectItem.technologies.split(",").map(t => t.trim()).filter(Boolean)
        : [],
      liveUrl: projectItem.liveUrl || "",
      githubUrl: projectItem.githubUrl || ""
    };

    current.sections.projects.list.push(newProject);
    await this.updateSection("projects", current.sections.projects);
    return { newProject, projects: current.sections.projects };
  }

  async deleteProject(id) {
    const current = await this.getPortfolio();
    if (current.sections?.projects?.list) {
      current.sections.projects.list = current.sections.projects.list.filter(
        (p, idx) => p.id !== id && String(idx) !== String(id)
      );
      await this.updateSection("projects", current.sections.projects);
    }
    return current.sections?.projects;
  }

  async resetPortfolio() {
    writeJsonFile(PORTFOLIO_FILE, defaultPortfolioData);

    if (this.isDbReady()) {
      try {
        await Portfolio.findOneAndUpdate(
          { slug: "main" },
          {
            $set: {
              profile: defaultPortfolioData.profile,
              navigation: defaultPortfolioData.navigation,
              sections: defaultPortfolioData.sections
            }
          },
          { upsert: true, new: true }
        );
      } catch (err) {
        console.error("DB resetPortfolio error:", err.message);
      }
    }
    return defaultPortfolioData;
  }

  // --- Message / Inquiries Operations ---

  async getMessages() {
    if (this.isDbReady()) {
      try {
        const list = await Message.find().sort({ createdAt: -1 }).lean();
        writeJsonFile(MESSAGES_FILE, list);
        return list;
      } catch (err) {
        console.error("DB getMessages error:", err.message);
      }
    }
    return readJsonFile(MESSAGES_FILE, []);
  }

  async addMessage(msgData) {
    let newMsg = {
      name: msgData.name || "Anonymous",
      email: msgData.email || "",
      subject: msgData.subject || "No Subject",
      message: msgData.message || "",
      isRead: false,
      createdAt: new Date().toISOString()
    };

    if (this.isDbReady()) {
      try {
        const created = await Message.create(newMsg);
        newMsg = created.toObject();
      } catch (err) {
        console.error("DB addMessage error:", err.message);
        newMsg.id = "msg-" + Date.now();
      }
    } else {
      newMsg.id = "msg-" + Date.now();
    }

    const messages = readJsonFile(MESSAGES_FILE, []);
    messages.unshift(newMsg);
    writeJsonFile(MESSAGES_FILE, messages);
    return newMsg;
  }

  async markMessageRead(id, isRead = true) {
    if (this.isDbReady()) {
      try {
        if (mongoose.isValidObjectId(id)) {
          const updated = await Message.findByIdAndUpdate(id, { isRead }, { new: true }).lean();
          return updated;
        }
      } catch (err) {
        console.error("DB markMessageRead error:", err.message);
      }
    }

    const messages = readJsonFile(MESSAGES_FILE, []);
    const found = messages.find(m => String(m._id || m.id) === String(id));
    if (found) {
      found.isRead = isRead;
      writeJsonFile(MESSAGES_FILE, messages);
      return found;
    }
    return null;
  }

  async deleteMessage(id) {
    if (this.isDbReady()) {
      try {
        if (mongoose.isValidObjectId(id)) {
          await Message.findByIdAndDelete(id);
        }
      } catch (err) {
        console.error("DB deleteMessage error:", err.message);
      }
    }

    const messages = readJsonFile(MESSAGES_FILE, []);
    const filtered = messages.filter(m => String(m._id || m.id) !== String(id));
    writeJsonFile(MESSAGES_FILE, filtered);
    return { success: true, count: filtered.length };
  }

  // --- User & Auth Operations ---

  async findUser(identifier) {
    const ident = identifier.trim().toLowerCase();

    if (this.isDbReady()) {
      try {
        const dbUser = await User.findOne({
          $or: [
            { username: { $regex: new RegExp(`^${ident}$`, "i") } },
            { email: { $regex: new RegExp(`^${ident}$`, "i") } }
          ]
        }).lean();
        if (dbUser) return dbUser;
      } catch (err) {
        console.error("DB findUser error:", err.message);
      }
    }

    const users = readJsonFile(USERS_FILE, []);
    return users.find(
      u => u.username.toLowerCase() === ident || u.email.toLowerCase() === ident
    );
  }

  async updateUserPassword(usernameOrEmail, newPassword) {
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    const ident = usernameOrEmail.trim().toLowerCase();

    if (this.isDbReady()) {
      try {
        await User.findOneAndUpdate(
          {
            $or: [
              { username: { $regex: new RegExp(`^${ident}$`, "i") } },
              { email: { $regex: new RegExp(`^${ident}$`, "i") } }
            ]
          },
          { $set: { password: hashedPassword } }
        );
      } catch (err) {
        console.error("DB updateUserPassword error:", err.message);
      }
    }

    const users = readJsonFile(USERS_FILE, []);
    const user = users.find(
      u => u.username.toLowerCase() === ident || u.email.toLowerCase() === ident
    );
    if (user) {
      user.password = hashedPassword;
      writeJsonFile(USERS_FILE, users);
    }
    return true;
  }
}

export const storageService = new StorageService();
