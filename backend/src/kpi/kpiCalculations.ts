import type { KpiRange, TrendPoint } from "./types.js";

export function getRangeStart(range: KpiRange) {
  const now = new Date();

  if (range === "today") {
    now.setHours(0, 0, 0, 0);
    return now;
  }

  const days = range === "7d" ? 7 : 30;
  now.setDate(now.getDate() - (days - 1));
  now.setHours(0, 0, 0, 0);
  return now;
}

export function normalizeRange(value: unknown): KpiRange {
  return value === "today" || value === "7d" || value === "30d" ? value : "7d";
}

export function toDateKey(value: string | null | undefined) {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toISOString().slice(0, 10);
}

export function countByDate(values: string[]): TrendPoint[] {
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    const key = toDateKey(value);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, count]) => ({ date, count }));
}

export function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100) / 100;
}

export function readJsonArrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

export function isLoopDetected(operators: unknown) {
  if (!operators || typeof operators !== "object") return null;
  const loop = (operators as Record<string, unknown>).loop;
  if (typeof loop !== "string") return null;
  return !["미감지", "not_detected", "not detected", "offline", "none"].includes(loop.toLowerCase());
}
