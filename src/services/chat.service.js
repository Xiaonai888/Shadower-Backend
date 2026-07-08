const khmerIntroduction =
  "សួស្តី! ខ្ញុំឈ្មោះ Shadower។ ខ្ញុំជាជំនួយការ AI សម្រាប់ជួយអ្នកបង្កើត និងសរសេររឿងប្រលោមលោកជាភាសាខ្មែរ និងអង់គ្លេស។";

const englishIntroduction =
  "Hello! I’m Shadower, an AI assistant designed to help you create and write novels in Khmer and English.";

const limitedReply =
  "ឥឡូវនេះខ្ញុំកំពុងដំណើរការដំណាក់កាលដំបូង ហើយអាចឆ្លើយតែ សួស្តី, Hi ឬ Hello សិន។";

function normalizeMessage(message) {
  return message
    .trim()
    .toLowerCase()
    .replace(/[!?.។]+$/g, "")
    .replace(/\s+/g, " ");
}

export function createChatReply(message) {
  const normalized = normalizeMessage(message);

  if (/^សួស្តី(?:\s|$)/u.test(normalized)) {
    return khmerIntroduction;
  }

  if (/^(hi|hello)(?:\s|$)/u.test(normalized)) {
    return englishIntroduction;
  }

  return limitedReply;
}
