const REQUIRED_SERVER_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export type RequiredServerEnv = (typeof REQUIRED_SERVER_ENV)[number];

export function getEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value || value.length === 0) {
    return undefined;
  }

  return value;
}

export function getRequiredEnv(name: RequiredServerEnv): string {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Variabile ambiente mancante: ${name}`);
  }

  return value;
}

export function assertBaseEnv() {
  REQUIRED_SERVER_ENV.forEach((key) => {
    if (!getEnv(key)) {
      throw new Error(`Variabile ambiente mancante: ${key}`);
    }
  });
}
