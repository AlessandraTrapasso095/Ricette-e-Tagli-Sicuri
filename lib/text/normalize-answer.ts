const APOSTROPHES_REGEX = /[’‘`´]/g;
const WHITESPACE_REGEX = /\s+/g;

export function normalizeBookAnswer(input: string): string {
  return input
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(APOSTROPHES_REGEX, "'")
    .replace(WHITESPACE_REGEX, " ");
}

export function compareNormalizedAnswer(input: string, expectedNormalized: string): boolean {
  return normalizeBookAnswer(input) === normalizeBookAnswer(expectedNormalized);
}
