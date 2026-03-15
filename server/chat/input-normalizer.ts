export interface UserPromptContext {
  normalizedPrompt: string;
  customExclusions: string[];
  detectedPreferences: string[];
}

export function normalizeFreeText(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const TRAILING_EXCLUSION_NOISE = [
  "oggi",
  "stasera",
  "domani",
  "per favore",
  "grazie",
  "ti prego",
];

function cleanExtractedExclusion(input: string) {
  let value = normalizeFreeText(input)
    .replace(/^(?:il|lo|la|i|gli|le|un|uno|una)\s+/, "")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const noise of TRAILING_EXCLUSION_NOISE) {
    const suffix = ` ${noise}`;
    if (value.endsWith(suffix)) {
      value = value.slice(0, -suffix.length).trim();
    }
  }

  return value;
}

export function extractCustomExclusions(userPrompt: string): string[] {
  const text = normalizeFreeText(userPrompt);
  const candidates = new Set<string>();
  const segments = text.split(/[,.!?;:]/).map((segment) => segment.trim());

  for (const segment of segments) {
    if (segment.includes("senza ")) {
      const value = segment.split("senza ")[1]?.trim();
      if (value) {
        candidates.add(cleanExtractedExclusion(value.split(" ").slice(0, 4).join(" ")));
      }
    }

    if (segment.startsWith("no ")) {
      const value = segment.slice(3).trim();
      if (value) {
        candidates.add(cleanExtractedExclusion(value.split(" ").slice(0, 4).join(" ")));
      }
    }

    if (segment.includes("non ho ")) {
      const value = segment.split("non ho ")[1]?.trim();
      if (value) {
        candidates.add(cleanExtractedExclusion(value.split(" ").slice(0, 4).join(" ")));
      }
    }

    if (segment.includes("non abbiamo ")) {
      const value = segment.split("non abbiamo ")[1]?.trim();
      if (value) {
        candidates.add(cleanExtractedExclusion(value.split(" ").slice(0, 4).join(" ")));
      }
    }

    if (segment.includes("niente ")) {
      const value = segment.split("niente ")[1]?.trim();
      if (value) {
        candidates.add(cleanExtractedExclusion(value.split(" ").slice(0, 4).join(" ")));
      }
    }

    if (segment.includes("evita ")) {
      const value = segment.split("evita ")[1]?.trim();
      if (value) {
        candidates.add(cleanExtractedExclusion(value.split(" ").slice(0, 4).join(" ")));
      }
    }
  }

  return [...candidates].filter((item) => item.length >= 2);
}

function detectPreferences(userPrompt: string): string[] {
  const text = normalizeFreeText(userPrompt);
  const preferences: string[] = [];

  if (text.includes("fuori casa") || text.includes("siamo fuori")) {
    preferences.push("Oggi fuori casa: preferire pasti trasportabili e semplici.");
  }
  if (text.includes("in frigo") || text.includes("quello che ho")) {
    preferences.push("Usare ingredienti comuni e facilmente sostituibili in dispensa/frigo.");
  }

  return preferences;
}

export function buildUserPromptContext(userPrompt: string): UserPromptContext {
  return {
    normalizedPrompt: normalizeFreeText(userPrompt),
    customExclusions: extractCustomExclusions(userPrompt),
    detectedPreferences: detectPreferences(userPrompt),
  };
}
