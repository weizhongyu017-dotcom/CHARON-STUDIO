/**
 * MONTHLY NEWS archive.
 * `monthlyNewsIds` order = newest first (home shows only [0]).
 * Types: "poster" | "track" | "release"
 */
export const newsItems = {
  "gracie-abrams-dfh-deluxe-2026": {
    id: "gracie-abrams-dfh-deluxe-2026",
    type: "poster",
    kicker: "Monthly News ‣ Release",
    title: "Daughter From Hell",
    titleEn: "(Deluxe)",
    subtitle: "Gracie Abrams",
    date: "2026.11.20",
    venue: "New tracks arrive",
    venueEn: "Album deluxe drop",
    image: "./src/media/gracie-abrams-dfh-deluxe.jpg",
    note: "English release poster",
    objectPosition: "50% 50%",
    tone: "crimson",
    lettered: true,
  },
  "shan-yichun-wuxi-2026": {
    id: "shan-yichun-wuxi-2026",
    type: "poster",
    kicker: "Monthly News ‣ Live",
    title: "单依纯",
    titleEn: "SHAN YICHUN",
    subtitle: "无锡站",
    date: "2026.10.31",
    venue: "无锡奥林匹克体育中心",
    venueEn: "Wuxi Olympic Sports Center",
    image: "./src/media/shan-yichun-live.jpg",
    note: "Concert night",
    objectPosition: "28% 12%",
  },
  "monthly-best-track": {
    id: "monthly-best-track",
    type: "track",
    kicker: "Monthly News ‣ Track",
    rating: 9.1,
    scoreLabel: "Score",
    metaPlaceholders: [
      { label: "Mood", value: "Neon bass" },
      { label: "Era", value: "2025–26" },
      { label: "Note", value: "September FAV.01 — night-drive density" },
    ],
  },
};

/** Newest-first feed. Home teaser = first item only. */
export const monthlyNewsIds = [
  "gracie-abrams-dfh-deluxe-2026",
  "shan-yichun-wuxi-2026",
];
