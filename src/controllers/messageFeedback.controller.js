import {
  getMessageFeedback as getMessageFeedbackRecord,
  saveMessageFeedback,
  updateMessageFeedback as updateMessageFeedbackRecord
} from "../services/messageFeedback.service.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const RATINGS = new Set(["good", "bad"]);
const ERROR_TYPES = new Set([
  "missed_user_intent",
  "wrong_topic",
  "factual_error",
  "incomplete",
  "continuity_error",
  "ignored_instruction",
  "too_short",
  "unnatural_language",
  "other"
]);

const FIELD_LIMITS = {
  correctionText: 20000,
  acceptedAnswer: 20000,
  taskType: 120,
  modelVersion: 200
};

function sendError(res, error, fallbackMessage) {
  console.error("Message feedback request failed", {
    name: error?.name,
    statusCode: error?.statusCode,
    message: error?.message
  });

  return res.status(error?.statusCode || 500).json({
    ok: false,
    message: error?.publicMessage || fallbackMessage
  });
}

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
}

function normalizeOptionalText(value, maxLength) {
  if (value === undefined) {
    return { valid: true, supplied: false };
  }

  if (value === null || value === "") {
    return {
      valid: true,
      supplied: true,
      value: null
    };
  }

  if (
    typeof value !== "string" ||
    value.trim().length > maxLength
  ) {
    return { valid: false, supplied: true };
  }

  return {
    valid: true,
    supplied: true,
    value: value.trim()
  };
}

function normalizeMetadata(value) {
  if (value === undefined) {
    return { valid: true, supplied: false };
  }

  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return { valid: false, supplied: true };
  }

  return {
    valid: true,
    supplied: true,
    value
  };
}

function validateOptionalFields(body) {
  const values = {};
  const errors = [];

  for (const field of Object.keys(FIELD_LIMITS)) {
    const result = normalizeOptionalText(
      body[field],
      FIELD_LIMITS[field]
    );

    if (!result.valid) {
      errors.push(`${field} is invalid or too long.`);
      continue;
    }

    if (result.supplied) {
      values[field] = result.value;
    }
  }

  if (body.errorType !== undefined) {
    if (
      body.errorType !== null &&
      body.errorType !== "" &&
      !ERROR_TYPES.has(body.errorType)
    ) {
      errors.push("Invalid feedback error type.");
    } else {
      values.errorType = body.errorType || null;
    }
  }

  const metadata = normalizeMetadata(body.metadata);
  if (!metadata.valid) {
    errors.push("Feedback metadata must be an object.");
  } else if (metadata.supplied) {
    values.metadata = metadata.value;
  }

  return { errors, values };
}

function toDatabaseFields(values) {
  const mapping = {
    errorType: "error_type",
    correctionText: "correction_text",
    acceptedAnswer: "accepted_answer",
    taskType: "task_type",
    modelVersion: "model_version",
    metadata: "metadata"
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      mapping[key] || key,
      value
    ])
  );
}

export async function createMessageFeedback(req, res) {
  const body = req.body ?? {};
  const errors = [];

  if (!isUuid(body.chatId)) {
    errors.push("Invalid chat ID.");
  }

  if (!isUuid(body.messageId)) {
    errors.push("Invalid assistant message ID.");
  }

  if (!RATINGS.has(body.rating)) {
    errors.push("Rating must be good or bad.");
  }

  const optional = validateOptionalFields(body);
  errors.push(...optional.errors);

  if (errors.length) {
    return res.status(400).json({
      ok: false,
      message: errors[0],
      errors
    });
  }

  try {
    const feedback = await saveMessageFeedback({
      chatId: body.chatId.trim(),
      messageId: body.messageId.trim(),
      rating: body.rating,
      ...optional.values
    });

    return res.status(200).json({
      ok: true,
      feedback
    });
  } catch (error) {
    return sendError(res, error, "Unable to save this feedback.");
  }
}

export async function getMessageFeedback(req, res) {
  const { messageId } = req.params;

  if (!isUuid(messageId)) {
    return res.status(400).json({
      ok: false,
      message: "Invalid assistant message ID."
    });
  }

  try {
    const feedback = await getMessageFeedbackRecord(messageId.trim());

    return res.status(200).json({
      ok: true,
      feedback
    });
  } catch (error) {
    return sendError(res, error, "Unable to load this feedback.");
  }
}

export async function updateMessageFeedback(req, res) {
  const { id } = req.params;
  const body = req.body ?? {};

  if (!isUuid(id)) {
    return res.status(400).json({
      ok: false,
      message: "Invalid feedback ID."
    });
  }

  const values = {};

  if (body.rating !== undefined) {
    if (!RATINGS.has(body.rating)) {
      return res.status(400).json({
        ok: false,
        message: "Rating must be good or bad."
      });
    }

    values.rating = body.rating;
  }

  const optional = validateOptionalFields(body);
  if (optional.errors.length) {
    return res.status(400).json({
      ok: false,
      message: optional.errors[0],
      errors: optional.errors
    });
  }

  Object.assign(values, optional.values);

  if (!Object.keys(values).length) {
    return res.status(400).json({
      ok: false,
      message: "No feedback changes were provided."
    });
  }

  try {
    const feedback = await updateMessageFeedbackRecord(
      id.trim(),
      toDatabaseFields(values)
    );

    return res.status(200).json({
      ok: true,
      feedback
    });
  } catch (error) {
    return sendError(res, error, "Unable to update this feedback.");
  }
}
