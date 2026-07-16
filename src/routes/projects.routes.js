import { Router } from "express";
import {
  getProject,
  getProjectSchema,
  getProjects
} from "../controllers/projects.controller.js";

const router = Router();

router.get("/", getProjects);
router.get("/schema", getProjectSchema);
router.get("/:id", getProject);

export default router;
