/**
 * MONTHLY NEWS archive.
 * `monthlyNewsIds` order = newest first (home shows only [0]).
 * Types: "poster" | "track" | "release"
 */
export const newsItems = {
  "ariana-grande-grammy-noms-2027": {
    id: "ariana-grande-grammy-noms-2027",
    type: "poster",
    kicker: "Monthly News ‣ Awards",
    title: "69th GRAMMYs",
    titleEn: "Nominations",
    subtitle: "Ariana Grande",
    date: "2026.11.16",
    venue: "6 nominations",
    venueEn: "The 69th Annual Grammy Awards",
    image: "./src/media/ariana-grande-grammy-noms-2027.jpg",
    note: "Recording Academy · nominees announced",
    objectPosition: "50% 32%",
    noms: [
      {
        cat: "Song Of The Year",
        work: "Hate That I Made You Love Me",
      },
      {
        cat: "Best Pop Vocal Album",
        work: "Petal",
      },
      {
        cat: "Best Immersive Audio Album",
        work: "Petal",
      },
      {
        cat: "Best Music Video",
        work: "Hate That I Made You Love Me",
      },
      {
        cat: "Best Traditional Pop Vocal Performance",
        work: "For Good (with Cynthia Erivo)",
      },
      {
        cat: "Best Compilation Soundtrack For Visual Media",
        work: "Wicked: For Good (Soundtrack)",
      },
    ],
  },
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
    homeImage: "./src/media/gracie-abrams-dfh-cover.png",
    note: "English release poster",
    objectPosition: "42% 40%",
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
  "ariana-grande-grammy-noms-2027",
  "gracie-abrams-dfh-deluxe-2026",
  "shan-yichun-wuxi-2026",
];
