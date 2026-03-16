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

  return "benvenuta/o";
}

export function getCapitalizedWelcomeParticiple(gender: OptionalUserGender) {
  if (gender === "maschio") {
    return "Benvenuto";
  }

  if (gender === "femmina") {
    return "Benvenuta";
  }

  return "Benvenuta/o";
}

export function getDashboardWelcome(gender: OptionalUserGender) {
  return `${getWelcomeParticiple(gender)} nell'Area Lettori`;
}

export function getWelcomeEmailSubject(gender: OptionalUserGender) {
  return `${getCapitalizedWelcomeParticiple(gender)} nell'Area Lettori - Ricette e Tagli Sicuri`;
}
