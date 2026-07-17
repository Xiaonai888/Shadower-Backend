const INTENT_RULES = [
  {
    id: "translate",
    patterns: [/\btranslate\b/i, /\btranslation\b/i, /បកប្រែ/u]
  },
  {
    id: "summarize",
    patterns: [/\bsummar(?:y|ize|ise)\b/i, /សង្ខេប/u]
  },
  {
    id: "check_continuity",
    patterns: [
      /\bcontinuity\b/i,
      /\binconsisten(?:cy|t)\b/i,
      /\bplot hole\b/i,
      /\banaly[sz]e (?:the )?(?:story|scene|chapter)\b/i,
      /\breview (?:the )?(?:story|scene|chapter)\b/i,
      /ភាពស៊ីសង្វាក់/u,
      /ខុសគ្នាក្នុងសាច់រឿង/u,
      /ចន្លោះសាច់រឿង/u,
      /វិភាគសាច់រឿង/u,
      /ឆែកសាច់រឿង/u,
      /ពិនិត្យសាច់រឿង/u
    ]
  },
  {
    id: "rewrite",
    patterns: [
      /\brewrite\b/i,
      /\brephrase\b/i,
      /\bpolish\b/i,
      /\bedit (?:this|the)\b/i,
      /\bfix (?:this|the) (?:text|scene|chapter|story)\b/i,
      /សរសេរឡើងវិញ/u,
      /កែសម្រួល/u,
      /ជួយកែ/u,
      /កែសាច់រឿង/u
    ]
  },
  {
    id: "continue_story",
    patterns: [
      /^\s*next\s*[.!]?\s*$/i,
      /^\s*continue\s*[.!]?\s*$/i,
      /\bcontinue (?:the )?(?:story|chapter|scene|episode)\b/i,
      /\bnext (?:chapter|scene|episode|part)\b/i,
      /\bstart episode\b/i,
      /បន្តរឿង/u,
      /បន្តជំពូក/u,
      /បន្តឈុត/u,
      /បន្តភាគ/u,
      /^\s*បន្ទាប់\s*$/u,
      /ចាប់ផ្តើមភាគ/u
    ]
  },
  {
    id: "create_character",
    patterns: [
      /\bcreate (?:a )?character\b/i,
      /\bcharacter profile\b/i,
      /បង្កើតតួអង្គ/u,
      /ប្រវត្តិតួអង្គ/u
    ]
  },
  {
    id: "create_outline",
    patterns: [
      /\boutline\b/i,
      /\bstory plan\b/i,
      /\bchapter plan\b/i,
      /\bepisode plan\b/i,
      /គ្រោងរឿង/u,
      /គ្រោងជំពូក/u,
      /គ្រោងភាគ/u
    ]
  },
  {
    id: "question_about_story",
    patterns: [
      /\bwhat happened\b/i,
      /\bwho is\b/i,
      /\bwhy did\b/i,
      /\bexplain (?:the )?(?:story|scene|chapter)\b/i,
      /ក្នុងរឿង/u,
      /តួអង្គណា/u,
      /ហេតុអ្វីតួ/u,
      /សាច់រឿងនេះនិយាយពីអ្វី/u,
      /ពន្យល់សាច់រឿង/u
    ]
  },
  {
    id: "write_story",
    patterns: [
      /\bwrite (?:a )?(?:story|scene|chapter|novel|episode)\b/i,
      /\bcreate (?:a )?(?:story|scene|chapter|novel|episode)\b/i,
      /សរសេររឿង/u,
      /សរសេរជំពូក/u,
      /សរសេរឈុត/u,
      /សរសេរភាគ/u,
      /បង្កើតរឿង/u
    ]
  }
];

const INTENT_INSTRUCTIONS = {
  normal_chat: [
    "Answer the user's actual question directly.",
    "First identify the requested outcome, important constraints, and whether the answer requires factual precision or creative judgment.",
    "Do not substitute a related answer for the requested one.",
    "State uncertainty when required information is missing."
  ].join(" "),
  write_story: [
    "Before drafting, silently identify the point of view, scene goal, conflict, emotional turn, timeline position, characters present, known facts, and forbidden contradictions.",
    "Write polished scene prose rather than an outline or summary unless the user asks for one.",
    "Preserve established names, characterization, relationships, abilities, injuries, knowledge boundaries, tone, tense, point of view, and story rules.",
    "Do not invent a major fact merely to make the scene easier.",
    "Make dialogue, action, setting, and emotional progression serve the scene's purpose."
  ].join(" "),
  continue_story: [
    "Continue directly from the latest established ending.",
    "Do not restart, recap, repeat the previous scene, or jump time unless requested.",
    "Preserve the exact point of view, location, physical positions, objects, injuries, character knowledge, unresolved tension, and pacing.",
    "Silently check continuity before writing the next prose."
  ].join(" "),
  rewrite: [
    "Rewrite only the requested material.",
    "Preserve meaning, names, facts, point of view, chronology, and protected constraints unless the user explicitly asks to change them.",
    "Fix the stated problem without replacing unrelated content."
  ].join(" "),
  summarize: [
    "Create a selective summary, not a rewrite or scene-by-scene retelling.",
    "Keep only the central events, decisions, facts, causes, outcomes, and unresolved points.",
    "Aim for roughly 15 to 25 percent of the source length unless the user requests another size.",
    "Do not copy full paragraphs from the source.",
    "Remove repetition, decorative wording, most dialogue, examples, and minor details unless they are essential.",
    "Use concise sections or bullets when they improve clarity.",
    "Separate confirmed facts from interpretation and never invent missing events."
  ].join(" "),
  translate: [
    "Translate faithfully into the requested language.",
    "Preserve names, tone, formatting, chronology, story meaning, and intentional ambiguity.",
    "Do not add explanations unless requested."
  ].join(" "),
  create_character: [
    "Create a consistent character profile with role, motivation, personality, relationships, strengths, flaws, boundaries, voice, and story function.",
    "Check that the character does not conflict with established story facts."
  ].join(" "),
  create_outline: [
    "Create a structured outline with clear progression, turning points, conflicts, cause and effect, emotional development, and continuity with known facts.",
    "Separate confirmed canon from proposed new ideas."
  ].join(" "),
  check_continuity: [
    "Act as a strict continuity editor.",
    "Identify contradictions, timeline problems, impossible knowledge, point-of-view violations, changed names, relationship conflicts, physical-position errors, accessibility errors, and unresolved plot logic.",
    "For each issue, explain the evidence, severity, and smallest safe correction.",
    "Do not rewrite unaffected material."
  ].join(" "),
  question_about_story: [
    "Answer only from supplied conversation, project data, and remembered story facts.",
    "Separate confirmed facts, reasonable inference, and unknown information.",
    "Clearly say when the available story context does not contain the answer."
  ].join(" ")
};

export function detectChatIntent(message) {
  const text = typeof message === "string" ? message.trim() : "";

  if (!text) {
    return "normal_chat";
  }

  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return rule.id;
    }
  }

  return "normal_chat";
}

export function getIntentInstruction(intent) {
  return INTENT_INSTRUCTIONS[intent] || INTENT_INSTRUCTIONS.normal_chat;
}
