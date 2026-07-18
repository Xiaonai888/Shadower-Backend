import { getSupabaseAdmin } from "../config/supabase.js";

const SCAN_LIMIT = 300;
const MATCH_LIMIT = 3;
const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "how", "i", "in", "is", "it", "my", "of", "on", "or", "that",
  "the", "this", "to", "was", "what", "when", "where", "which",
  "who", "why", "with", "you", "your"
]);

function clean(value, limit = 6000) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function normalize(value) {
  return clean(value)
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value) {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
  );
}

function ngramSet(value, size = 3) {
  const text = normalize(value).replace(/\s+/g, "").slice(0, 600);
  const grams = new Set();

  if (!text) return grams;
  if (text.length <= size) {
    grams.add(text);
    return grams;
  }

  for (let index = 0; index <= text.length - size; index += 1) {
    grams.add(text.slice(index, index + size));
  }

  return grams;
}

function intersectionSize(left, right) {
  const smaller = left.size <= right.size ? left : right;
  const larger = left.size <= right.size ? right : left;
  let count = 0;

  for (const value of smaller) {
    if (larger.has(value)) count += 1;
  }

  return count;
}

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  const intersection = intersectionSize(left, right);
  return intersection / (left.size + right.size - intersection);
}

function containment(left, right) {
  if (!left.size || !right.size) return 0;
  return intersectionSize(left, right) / Math.min(left.size, right.size);
}

function scoreText(query, candidate) {
  const left = normalize(query);
  const right = normalize(candidate);

  if (!left || !right) return 0;
  if (left === right) return 1;

  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  const phraseMatch =
    left.length >= 8 && right.length >= 8 &&
    (left.includes(right) || right.includes(left))
      ? 1
      : 0;

  return Math.min(
    1,
    jaccard(leftTokens, rightTokens) * 0.42 +
      containment(leftTokens, rightTokens) * 0.24 +
      jaccard(ngramSet(left), ngramSet(right)) * 0.26 +
      phraseMatch * 0.08
  );
}

function minimumScore(message) {
  const text = normalize(message);
  const count = tokenSet(text).size;

  if (text.length < 12 || count <= 1) return 0.52;
  if (text.length < 30 || count <= 3) return 0.32;
  return 0.2;
}

function expandedQuery({ message, analysis, history }) {
  const recentUsers = Array.isArray(history)
    ? history
        .filter((item) => item?.role === "user")
        .slice(-2)
        .map((item) => clean(item.content, 900))
    : [];

  return [
    clean(message, 3000),
    clean(analysis?.userGoal, 900),
    ...(Array.isArray(analysis?.constraints)
      ? analysis.constraints.slice(0, 8).map((item) => clean(item, 400))
      : []),
    ...recentUsers
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeMatch(row, score) {
  const accepted = clean(row.accepted_answer, 2200);
  const correction = clean(row.correction_text, 2200);

  return {
    id: row.id,
    score: Number(score.toFixed(4)),
    previousRequest: clean(row.prompt_snapshot, 1800),
    lesson: accepted || correction,
    accepted: Boolean(accepted),
    errorType: clean(row.error_type, 120) || null,
    taskType: clean(row.task_type, 120) || null
  };
}

export async function loadRelevantCorrections({
  message,
  analysis,
  history = []
}) {
  const currentMessage = clean(message);

  if (!currentMessage) {
    return { source: "not_requested", scannedCount: 0, matches: [] };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("ai_message_feedback")
      .select(
        "id, prompt_snapshot, correction_text, accepted_answer, error_type, task_type, updated_at"
      )
      .eq("rating", "bad")
      .order("updated_at", { ascending: false })
      .limit(SCAN_LIMIT);

    if (error) throw error;

    const rows = (data ?? []).filter(
      (row) =>
        clean(row.prompt_snapshot) &&
        (clean(row.accepted_answer) || clean(row.correction_text))
    );
    const expanded = expandedQuery({ message, analysis, history });
    const threshold = minimumScore(currentMessage);
    const currentTask = clean(analysis?.requestKind || analysis?.intent, 120);

    const matches = rows
      .map((row, index) => {
        const direct = scoreText(currentMessage, row.prompt_snapshot);
        const contextual = scoreText(expanded, row.prompt_snapshot);
        const taskBonus =
          currentTask && clean(row.task_type, 120) === currentTask ? 0.06 : 0;
        const acceptedBonus = clean(row.accepted_answer) ? 0.04 : 0;
        const recencyBonus = Math.max(0, 0.03 - index * 0.0001);
        const score = Math.min(
          1,
          Math.max(direct, contextual * 0.92) +
            taskBonus +
            acceptedBonus +
            recencyBonus
        );

        return normalizeMatch(row, score);
      })
      .filter((match) => match.score >= threshold)
      .sort((left, right) => right.score - left.score)
      .slice(0, MATCH_LIMIT);

    return {
      source: "database",
      scannedCount: rows.length,
      matches
    };
  } catch (error) {
    console.error("Correction memory retrieval failed", {
      name: error?.name,
      message: error?.message
    });

    return { source: "database_error", scannedCount: 0, matches: [] };
  }
}
