import { createChatReply } from "../services/chat.service.js";

export function sendChatMessage(req, res) {
  const { message } = req.body;

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      ok: false,
      message: "Message is required"
    });
  }

  if (message.length > 1000) {
    return res.status(400).json({
      ok: false,
      message: "Message must not exceed 1000 characters"
    });
  }

  const reply = createChatReply(message);

  return res.status(200).json({
    ok: true,
    reply
  });
}
