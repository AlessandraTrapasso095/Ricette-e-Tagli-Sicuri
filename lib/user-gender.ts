export const USER_GENDERS = ["femmina", "maschio"] as const;

export type UserGender = (typeof USER_GENDERS)[number];
export type OptionalUserGender = UserGender | null;

export function normalizeUserGender(value: unknown): OptionalUserGender {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return USER_GENDERS.includes(normalized as UserGender) ? (normalized as UserGender) : null;
}

export function getWelcomeParticiple(gender: OptionalUserGender) {
  if (gender === "maschio") {
    return "benvenuto";
  }

  if (gender === "femmina") {
    return "benvenuta";
  }

  return null;
}

export function getCapitalizedWelcomeParticiple(gender: OptionalUserGender) {
  if (gender === "maschio") {
    return "Benvenuto";
  }

  if (gender === "femmina") {
    return "Benvenuta";
  }

  return null;
}

export function getDashboardWelcome(gender: OptionalUserGender) {
  const welcome = getWelcomeParticiple(gender);
  return welcome ? `${welcome} nell'Area Lettori` : "questa è la tua Area Lettori";
}

export function getWelcomeEmailSubject(gender: OptionalUserGender) {
  const welcome = getCapitalizedWelcomeParticiple(gender);
  return welcome ? `${welcome} nell'Area Lettori - Ricette e Tagli Sicuri` : "Area Lettori - Ricette e Tagli Sicuri";
}

export function getWelcomeEmailSentence(gender: OptionalUserGender) {
  const welcome = getWelcomeParticiple(gender);
  return welcome
    ? `${welcome} nella tua Area Lettori di Ricette e Tagli Sicuri.`
    : "Ora hai accesso alla tua Area Lettori di Ricette e Tagli Sicuri.";
}
