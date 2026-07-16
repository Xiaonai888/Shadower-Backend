import {
  getProjectById,
  getProjectsSchema,
  listProjects
} from "../services/projects.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendError(res, error, fallbackMessage) {
  console.error("Project request failed", {
    name: error?.name,
    statusCode: error?.statusCode,
    message: error?.message
  });

  return res.status(error?.statusCode || 500).json({
    ok: false,
    message: error?.publicMessage || fallbackMessage
  });
}

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
    return sendError(res, error, "Unable to load story projects.");
  }
}

export async function getProjectSchema(req, res) {
  try {
    const schema = await getProjectsSchema();

    return res.status(200).json({
      ok: true,
      schema
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Unable to inspect the story project schema."
    );
  }
}

export async function getProject(req, res) {
  const projectId = req.params?.id?.trim();

  if (!UUID_PATTERN.test(projectId || "")) {
    return res.status(400).json({
      ok: false,
      message: "Invalid project ID."
    });
  }

  try {
    const project = await getProjectById(projectId);

    return res.status(200).json({
      ok: true,
      project
    });
  } catch (error) {
    return sendError(res, error, "Unable to load this story project.");
  }
}
