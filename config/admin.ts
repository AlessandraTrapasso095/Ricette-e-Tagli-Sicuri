const DEFAULT_ADMIN_EMAILS = ["ricettetaglisicuri@gmail.com"];

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export const ADMIN_EMAIL_ALLOWLIST = new Set(DEFAULT_ADMIN_EMAILS.map(normalizeEmail));

export function isAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  return ADMIN_EMAIL_ALLOWLIST.has(normalizeEmail(email));
}
