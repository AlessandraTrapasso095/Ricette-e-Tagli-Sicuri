const APP_TIME_ZONE = "Europe/Rome";

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function parseDateOnly(value: string): DateParts | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function getDatePartsInTimeZone(date: Date, timeZone: string): DateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

export function computeAgeInMonthsFromBirthDate(
  birthDate: string,
  referenceDate: Date = new Date(),
  timeZone: string = APP_TIME_ZONE,
) {
  const birth = parseDateOnly(birthDate);

  if (!birth) {
    return null;
  }

  const today = getDatePartsInTimeZone(referenceDate, timeZone);
  let months = (today.year - birth.year) * 12 + (today.month - birth.month);

  if (today.day < birth.day) {
    months -= 1;
  }

  return months >= 0 ? months : null;
}
