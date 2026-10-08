import express from "express";
import { storageService } from "../services/storageService.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// GET /api/portfolio - Public: fetch complete portfolio data from DB
router.get("/", async (req, res) => {
  try {
    const data = await storageService.getPortfolio();
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error("Error getting portfolio data:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve portfolio data."
    });
  }
});

// PUT /api/portfolio/skills - Protected: update skills array directly
router.put("/skills", authenticateToken, async (req, res) => {
  try {
    const skillsArray = Array.isArray(req.body) ? req.body : req.body.skills || req.body.content;
    if (!Array.isArray(skillsArray)) {
      return res.status(400).json({ success: false, message: "Skills must be an array." });
    }
    const updated = await storageService.updateSkills(skillsArray);
    return res.status(200).json({
      success: true,
      message: "Skills updated successfully in MongoDB!",
      data: updated.sections?.about?.skills
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/portfolio/experience - Protected: update work experience array directly
router.put("/experience", authenticateToken, async (req, res) => {
  try {
    const expArray = Array.isArray(req.body) ? req.body : req.body.experience;
    if (!Array.isArray(expArray)) {
      return res.status(400).json({ success: false, message: "Experience must be an array." });
    }
    const updated = await storageService.updateExperience(expArray);
    return res.status(200).json({
      success: true,
      message: "Work experience updated successfully in MongoDB!",
      data: updated.sections?.resume?.experience
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/portfolio/projects/toggle - Protected: toggle projects section visibility
router.patch("/projects/toggle", authenticateToken, async (req, res) => {
  try {
    const { enabled } = req.body;
    const updated = await storageService.toggleProjects(enabled);
    return res.status(200).json({
      success: true,
      message: `Projects section ${updated.sections?.projects?.enabled ? "enabled" : "hidden"} successfully!`,
      enabled: updated.sections?.projects?.enabled,
      projects: updated.sections?.projects
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/portfolio/projects - Protected: add new project
router.post("/projects", authenticateToken, async (req, res) => {
  try {
    const { title, description, image, technologies, liveUrl, githubUrl } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: "Project title is required." });
    }
    const result = await storageService.addProject({
      title,
      description,
      image,
      technologies,
      liveUrl,
      githubUrl
    });
    return res.status(201).json({
      success: true,
      message: "Project added successfully to MongoDB!",
      project: result.newProject,
      projects: result.projects
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/portfolio/projects/:id - Protected: delete project
router.delete("/projects/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updatedProjects = await storageService.deleteProject(id);
    return res.status(200).json({
      success: true,
      message: "Project removed successfully!",
      projects: updatedProjects
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/portfolio - Protected: full or partial update in DB
router.put("/", authenticateToken, async (req, res) => {
  try {
    const updated = await storageService.updatePortfolio(req.body);
    return res.status(200).json({
      success: true,
      message: "Portfolio data updated successfully in database!",
      data: updated
    });
  } catch (error) {
    console.error("Error updating portfolio:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update portfolio data."
    });
  }
});

// PUT /api/portfolio/:section - Protected: update a specific section
router.put("/:section", authenticateToken, async (req, res) => {
  try {
    const { section } = req.params;
    const updated = await storageService.updateSection(section, req.body);
    return res.status(200).json({
      success: true,
      message: `Section '${section}' updated successfully in database!`,
      data: section === "profile" || section === "navigation" ? updated[section] : updated.sections?.[section]
    });
  } catch (error) {
    console.error(`Error updating section ${req.params.section}:`, error);
    return res.status(500).json({
      success: false,
      message: `Failed to update section ${req.params.section}.`
    });
  }
});

// POST /api/portfolio/reset - Protected: reset back to defaults
router.post("/reset", authenticateToken, async (req, res) => {
  try {
    const resetData = await storageService.resetPortfolio();
    return res.status(200).json({
      success: true,
      message: "Portfolio data successfully restored to default settings in database!",
      data: resetData
    });
  } catch (error) {
    console.error("Error resetting portfolio:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reset portfolio data."
    });
  }
});

// POST /api/portfolio/services - Protected: add service
router.post("/services", authenticateToken, async (req, res) => {
  try {
    const { title, description, image } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required." });
    }
    const portfolio = await storageService.getPortfolio();
    if (!portfolio.sections) portfolio.sections = {};
    if (!portfolio.sections.services) {
      portfolio.sections.services = { title: "Services", list: [] };
    }
    if (!Array.isArray(portfolio.sections.services.list)) {
      portfolio.sections.services.list = [];
    }

    const newService = {
      id: "srv-" + Date.now(),
      title,
      description: description || "",
      image: image || "frontend.jpg"
    };

    portfolio.sections.services.list.push(newService);
    await storageService.updateSection("services", portfolio.sections.services);

    return res.status(201).json({
      success: true,
      message: "Service added successfully to database!",
      service: newService,
      services: portfolio.sections.services.list
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/portfolio/services/:id - Protected: delete service
router.delete("/services/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const portfolio = await storageService.getPortfolio();
    if (portfolio.sections?.services?.list) {
      portfolio.sections.services.list = portfolio.sections.services.list.filter(
        (s, idx) => s.id !== id && String(idx) !== id
      );
      await storageService.updateSection("services", portfolio.sections.services);
    }
    return res.status(200).json({
      success: true,
      message: "Service deleted successfully from database!",
      services: portfolio.sections?.services?.list || []
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
