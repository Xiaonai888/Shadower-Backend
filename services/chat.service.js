import OpenAI from "openai";
import { SHADOWER_INSTRUCTIONS } from "../config/shadowerPrompt.js";

const DEFAULT_MODEL = "gpt-5.4-mini";
const DEFAULT_SEARCH_MODEL = "gpt-5.5";

let openaiClient;

function createPublicError(statusCode, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.publicMessage = publicMessage;
  return error;
}

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw createPublicError(
      503,
      "Shadower AI is not configured yet. OPENAI_API_KEY is missing."
    );
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey,
      timeout: 60000,
      maxRetries: 1
    });
  }

  return openaiClient;
}

function mapOpenAIError(error) {
  if (error?.status === 401) {
    return createPublicError(
      503,
      "Shadower AI configuration is invalid. Please check the OpenAI API key."
    );
  }

  if (error?.status === 429) {
    return createPublicError(
      429,
      "Shadower AI usage limit has been reached. Please try again later."
    );
  }

  if (
    error?.name === "APIConnectionTimeoutError" ||
    error?.code === "ETIMEDOUT"
  ) {
    return createPublicError(
      504,
      "Shadower AI took too long to respond. Please try again."
    );
  }

  return createPublicError(
    502,
    "Shadower AI could not generate a response. Please try again."
  );
}

function getSourceTitle(title, url) {
  if (typeof title === "string" && title.trim()) {
    return title.trim();
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Web source";
  }
}

function extractResponseResult(response) {
  const output = Array.isArray(response.output) ? response.output : [];
  const textParts = [];
  const citations = [];
  const sources = [];
  const sourceByUrl = new Map();
  let textOffset = 0;
  let searchedWeb = false;

  for (const item of output) {
    if (item?.type === "web_search_call") {
      searchedWeb = true;
      continue;
    }

    if (item?.type !== "message" || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (content?.type !== "output_text" || typeof content.text !== "string") {
        continue;
      }

      if (textParts.length > 0) {
        textParts.push("\n");
        textOffset += 1;
      }

      const partOffset = textOffset;
      textParts.push(content.text);
      textOffset += content.text.length;

      const annotations = Array.isArray(content.annotations)
        ? content.annotations
        : [];

      for (const annotation of annotations) {
        if (annotation?.type !== "url_citation") {
          continue;
        }

        const citationData = annotation.url_citation ?? annotation;
        const url =
          typeof citationData.url === "string"
            ? citationData.url.trim()
            : "";

        if (!url) {
          continue;
        }

        const startIndex = Number(citationData.start_index);
        const endIndex = Number(citationData.end_index);

        if (
          !Number.isInteger(startIndex) ||
          !Number.isInteger(endIndex) ||
          startIndex < 0 ||
          endIndex <= startIndex ||
          endIndex > content.text.length
        ) {
          continue;
        }

        let source = sourceByUrl.get(url);

        if (!source) {
          source = {
            index: sources.length + 1,
            title: getSourceTitle(citationData.title, url),
            url
          };
          sourceByUrl.set(url, source);
          sources.push(source);
        }

        citations.push({
          startIndex: partOffset + startIndex,
          endIndex: partOffset + endIndex,
          sourceIndex: source.index,
          title: source.title,
          url: source.url
        });
      }
    }
  }

  const reply =
    textParts.join("") ||
    (typeof response.output_text === "string" ? response.output_text : "");

  const uniqueCitations = [];
  const citationKeys = new Set();

  for (const citation of citations.sort(
    (first, second) =>
      first.startIndex - second.startIndex ||
      first.endIndex - second.endIndex
  )) {
    const key = `${citation.startIndex}:${citation.endIndex}:${citation.url}`;

    if (!citationKeys.has(key)) {
      citationKeys.add(key);
      uniqueCitations.push(citation);
    }
  }

  return {
    reply,
    citations: uniqueCitations,
    sources,
    searchedWeb
  };
}

export async function createChatReply(
  message,
  history = [],
  { webSearch = false } = {}
) {
  try {
    const searchInstruction = webSearch
      ? "Web search is enabled for this request. Search when current or verifiable external information is needed, and cite the sources used."
      : "Web search is disabled for this request. Do not claim live verification of current information.";

    const request = {
      model: webSearch
        ? process.env.OPENAI_SEARCH_MODEL?.trim() || DEFAULT_SEARCH_MODEL
        : process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
      reasoning: {
        effort: "low"
      },
      instructions: `${SHADOWER_INSTRUCTIONS}\n\n${searchInstruction}`,
      input: [
        ...history,
        {
          role: "user",
          content: message
        }
      ],
      max_output_tokens: 1600,
      store: false
    };

    if (webSearch) {
      request.tools = [
        {
          type: "web_search"
        }
      ];
    }

    const response = await getOpenAIClient().responses.create(request);
    const result = extractResponseResult(response);

    if (!result.reply.trim()) {
      throw createPublicError(
        502,
        "Shadower AI returned an empty response. Please try again."
      );
    }

    return result;
  } catch (error) {
    if (error?.publicMessage) {
      throw error;
    }

    throw mapOpenAIError(error);
  }
}
