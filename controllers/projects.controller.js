import { listProjects } from "../services/projects.service.js";

export async function getProjects(req, res) {
  try {
    const projects = await listProjects({
      limit: req.query?.limit
    });

    return res.status(200).json({
      ok: true,
      count: projects.length,
      projects
    });
  } catch (error) {
    console.error("Project request failed", {
      name: error?.name,
      statusCode: error?.statusCode,
      message: error?.message
    });

    return res.status(error?.statusCode || 500).json({
      ok: false,
      message: error?.publicMessage || "Unable to load story projects."
    });
  }
}
