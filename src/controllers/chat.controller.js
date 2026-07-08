import { createChatReply } from "../services/chat.service.js";

export async function sendChatMessage(req, res) {
  const { message } = req.body ?? {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      ok: false,
      message: "Message is required"
    });
  }

  const cleanMessage = message.trim();

  if (cleanMessage.length > 12000) {
    return res.status(400).json({
      ok: false,
      message: "Message must not exceed 12,000 characters"
    });
  }

  try {
    const reply = await createChatReply(cleanMessage);

    return res.status(200).json({
      ok: true,
      reply
    });
  } catch (error) {
    console.error("Chat generation failed", {
      name: error?.name,
      status: error?.status,
      statusCode: error?.statusCode,
      code: error?.code,
      message: error?.message
    });

    return res.status(error?.statusCode || 500).json({
      ok: false,
      message:
        error?.publicMessage ||
        "Shadower AI is temporarily unavailable. Please try again."
    });
  }
}
