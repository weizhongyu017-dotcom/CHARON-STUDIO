import { year2022 } from "./year-2022.js";
import { year2023 } from "./year-2023.js";
import { year2024 } from "./year-2024.js";
import { year2025 } from "./year-2025.js";
import { year2026 } from "./year-2026.js";

export const YEARS = [year2022, year2023, year2024, year2025, year2026];

export const YEAR_MAP = Object.fromEntries(YEARS.map((y) => [y.year, y]));

export const ALL_MONTHS = YEARS.flatMap((y) => y.months);

/** Newest month across the archive (drives home field / current fav). */
export const LATEST_MONTH = ALL_MONTHS[ALL_MONTHS.length - 1];

export function findMonth(year, month) {
  return ALL_MONTHS.find((m) => m.year === year && m.month === month) || null;
}

export function monthsForYear(year) {
  return YEAR_MAP[year]?.months || [];
}
