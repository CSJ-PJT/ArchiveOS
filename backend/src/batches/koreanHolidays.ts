export const koreanHolidayYears = [2026] as const;

// Update this list yearly. Daily Slack reports fail safe when the target year
// is not listed here, because sending on an unknown Korean holiday is worse than skipping.
export const koreanHolidays: Record<number, Record<string, string>> = {
  2026: {
    "2026-01-01": "New Year's Day",
    "2026-02-16": "Seollal holiday",
    "2026-02-17": "Seollal",
    "2026-02-18": "Seollal holiday",
    "2026-03-01": "Independence Movement Day",
    "2026-03-02": "Substitute holiday for Independence Movement Day",
    "2026-05-01": "Labor Day",
    "2026-05-05": "Children's Day",
    "2026-05-24": "Buddha's Birthday",
    "2026-05-25": "Substitute holiday for Buddha's Birthday",
    "2026-06-03": "Local election day",
    "2026-06-06": "Memorial Day",
    "2026-08-15": "Liberation Day",
    "2026-08-17": "Substitute holiday for Liberation Day",
    "2026-09-24": "Chuseok holiday",
    "2026-09-25": "Chuseok",
    "2026-09-26": "Chuseok holiday",
    "2026-09-27": "Chuseok holiday",
    "2026-09-28": "Substitute holiday for Chuseok",
    "2026-10-03": "National Foundation Day",
    "2026-10-05": "Substitute holiday for National Foundation Day",
    "2026-10-09": "Hangeul Day",
    "2026-12-25": "Christmas Day",
  },
};
