import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function cleanListValue(input: string) {
  return input
    .normalize("NFKC")
    .replace(/[()[\]{}]/g, " ")
    .replace(/[’‘`´]/g, "'")
    .replace(/^[-•]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function toArrayFromCsv(input: string | string[]): string[] {
  const source = Array.isArray(input) ? input.join(",") : input;

  return source
    .split(/[,\n;]+/)
    .map((value) => cleanListValue(value))
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

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeHtmlWithLineBreaks(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br/>");
}
