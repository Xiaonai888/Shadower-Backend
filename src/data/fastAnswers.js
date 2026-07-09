const FAST_ANSWERS = [
  {
    id: "greeting",
    questions: [
      "hi",
      "hello",
      "hey",
      "សួស្តី",
      "ជំរាបសួរ"
    ],
    answer: "សួស្តី! តើខ្ញុំអាចជួយអ្វីបាន?"
  },
  {
    id: "what-is-shadower",
    questions: [
      "what is shadower",
      "shadower ជាអ្វី",
      "តើ shadower ជាអ្វី"
    ],
    answer:
      "Shadower គឺជា My AI ផ្ទាល់ខ្លួនសម្រាប់ជួយសន្ទនា និពន្ធរឿង គ្រប់គ្រង Story Data និងប្រើ Knowledge របស់ម្ចាស់កម្មវិធី។"
  }
];

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[?!.,;:'"()[\]{}<>/\\|@#$%^&*_+=~`-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findFastAnswer(message) {
  const normalizedMessage = normalizeText(message);

  if (!normalizedMessage) {
    return null;
  }

  for (const item of FAST_ANSWERS) {
    const matched = item.questions.some(
      (question) => normalizeText(question) === normalizedMessage
    );

    if (matched) {
      return {
        reply: item.answer,
        source: "fast-answer",
        answerId: item.id
      };
    }
  }

  return null;
}

export function getFastAnswerCatalog() {
  return FAST_ANSWERS.map((item) => ({
    id: item.id,
    questions: [...item.questions],
    answer: item.answer
  }));
}
