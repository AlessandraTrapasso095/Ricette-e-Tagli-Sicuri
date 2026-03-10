import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toArrayFromCsv(input: string): string[] {
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function formatRelativeMinutes(minutes: number): string {
  if (minutes <= 1) {
    return "meno di 1 minuto";
  }

  if (minutes < 60) {
    return `${minutes} minuti`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return hours === 1 ? "1 ora" : `${hours} ore`;
  }

  return `${hours}h ${remainingMinutes}m`;
}
