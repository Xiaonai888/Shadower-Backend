import { Router } from "express";
import {
  getProject,
  getProjects
} from "../controllers/projects.controller.js";

const router = Router();

router.get("/", getProjects);
router.get("/:id", getProject);

export default router;
