/**
 * Home “NOW” / live news layer.
 * Swap `activeId` to change what the second home screen shows.
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
    // rating / extra copy filled in later — framework only
    rating: null,
    scoreLabel: "Score",
    metaPlaceholders: [
      { label: "Mood", value: "—" },
      { label: "Era", value: "—" },
      { label: "Note", value: "—" },
    ],
  },
};

/** Currently featured home-news panel. Switch to "monthly-best-track" for default. */
export const activeNewsId = "shan-yichun-wuxi-2026";
