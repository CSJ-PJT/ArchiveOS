import { koreanHolidays } from "./koreanHolidays.js";

const seoulFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const seoulWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  weekday: "short",
});

export function getSeoulDateString(date = new Date()) {
  return seoulFormatter.format(date);
}

export function addDaysToDateString(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day + days, 0, 0, 0));
  return utcDate.toISOString().slice(0, 10);
}

export async function isKoreanBusinessDay(date: Date): Promise<{ businessDay: boolean; reason: string }> {
  const dateString = getSeoulDateString(date);
  const year = Number(dateString.slice(0, 4));
  const weekday = seoulWeekdayFormatter.format(date);

  if (weekday === "Sat" || weekday === "Sun") {
    return { businessDay: false, reason: "weekend" };
  }

  const holidayMap = koreanHolidays[year];
  if (!holidayMap) {
    return {
      businessDay: false,
      reason: `holiday data unavailable for ${year}`,
    };
  }

  const holidayName = holidayMap[dateString];
  if (holidayName) {
    return {
      businessDay: false,
      reason: holidayName.toLowerCase().includes("substitute")
        ? `substitute holiday: ${holidayName}`
        : `Korean holiday: ${holidayName}`,
    };
  }

  return { businessDay: true, reason: "business day" };
}
