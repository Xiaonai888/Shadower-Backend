import { getSupabaseAdmin } from "../config/supabase.js";

const SCHEMA_TIMEOUT_MS = 15000;

function createDatabaseError(error, publicMessage, statusCode = 500) {
  const databaseError = new Error(error?.message || publicMessage);
  databaseError.statusCode = statusCode;
  databaseError.publicMessage = publicMessage;
  return databaseError;
}

function getRestCredentials() {
  const url = process.env.SUPABASE_URL?.trim();
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !secretKey) {
    throw createDatabaseError(
      null,
      "Supabase is not configured in Render.",
      503
    );
  }

  return {
    restUrl: `${url.replace(/\/$/, "")}/rest/v1/`,
    secretKey
  };
}

async function fetchSchemaDocument() {
  const { restUrl, secretKey } = getRestCredentials();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCHEMA_TIMEOUT_MS);

  try {
    const response = await fetch(restUrl, {
      headers: {
        Accept: "application/openapi+json",
        Authorization: `Bearer ${secretKey}`,
        apikey: secretKey
      },
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw createDatabaseError(
        null,
        "Unable to inspect the story project schema.",
        502
      );
    }

    return payload;
  } catch (error) {
    if (error?.statusCode) {
      throw error;
    }

    if (error?.name === "AbortError") {
      throw createDatabaseError(
        error,
        "Story project schema inspection timed out.",
        504
      );
    }

    throw createDatabaseError(
      error,
      "Unable to inspect the story project schema.",
      502
    );
  } finally {
    clearTimeout(timeout);
  }
}

function findProjectDefinition(document) {
  const schemas = document?.components?.schemas || document?.definitions || {};

  return (
    schemas.ai_projects ||
    schemas.public_ai_projects ||
    Object.entries(schemas).find(([name]) =>
      name.toLowerCase().endsWith("ai_projects")
    )?.[1] ||
    null
  );
}

function normalizeSchema(definition) {
  const requiredFields = new Set(definition?.required || []);
  const properties = definition?.properties || {};

  return Object.entries(properties).map(([name, property]) => ({
    name,
    type: property?.type || "unknown",
    format: property?.format || null,
    required: requiredFields.has(name),
    readOnly: Boolean(property?.readOnly),
    nullable: property?.nullable !== false,
    default: property?.default ?? null
  }));
}

export async function listProjects({ limit = 50 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("ai_projects")
    .select("*")
    .limit(safeLimit);

  if (error) {
    throw createDatabaseError(error, "Unable to load story projects.");
  }

  return data ?? [];
}

export async function getProjectById(projectId) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("ai_projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw createDatabaseError(error, "Unable to load this story project.");
  }

  if (!data) {
    throw createDatabaseError(null, "Story project not found.", 404);
  }

  return data;
}

export async function getProjectsSchema() {
  const document = await fetchSchemaDocument();
  const definition = findProjectDefinition(document);

  if (!definition) {
    throw createDatabaseError(
      null,
      "The ai_projects schema was not found.",
      404
    );
  }

  return {
    table: "ai_projects",
    fields: normalizeSchema(definition)
  };
}
