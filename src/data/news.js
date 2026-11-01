/**
 * Home “NOW” / live news layer.
 * Swap `activeNewsId` to change what the second home screen shows.
 * Types: "poster" | "track" | "release"
 */
export const newsItems = {
  "shan-yichun-wuxi-2026": {
    id: "shan-yichun-wuxi-2026",
    type: "poster",
    kicker: "Live ‣ Now",
    title: "单依纯",
    titleEn: "SHAN YICHUN",
    subtitle: "无锡站",
    date: "2026.10.31",
    venue: "无锡奥林匹克体育中心",
    venueEn: "Wuxi Olympic Sports Center",
    image: "./src/media/shan-yichun-live.jpg",
    note: "Concert night",
  },
  "monthly-best-track": {
    id: "monthly-best-track",
    type: "track",
    kicker: "Now ‣ Monthly Best",
    rating: 9.1,
    scoreLabel: "Score",
    metaPlaceholders: [
      { label: "Mood", value: "Neon bass" },
      { label: "Era", value: "2025–26" },
      { label: "Note", value: "September FAV.01 — night-drive density" },
    ],
  },
};

/** Currently featured home-news panel. Switch to "monthly-best-track" for default. */
export const activeNewsId = "shan-yichun-wuxi-2026";
