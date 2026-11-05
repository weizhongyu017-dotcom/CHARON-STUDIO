/**
 * New Album Review archive.
 * `reviewIds` order = newest first.
 */
export const reviewItems = {
  "charlie-jeer-tamp-2026": {
    id: "charlie-jeer-tamp-2026",
    kicker: "Track Albums",
    title: "Take Away My Problems",
    artist: "Charlie Jeer",
    year: 2026,
    score: 8.8,
    by: "@charon",
    cover: "./src/media/charlie-jeer-tamp.jpg",
    review: "beautiful, romantic",
    reviewLimit: 1000,
    tracks: [
      { rank: 1, title: "small talk", artist: "Charlie Jeer / Cat Burns", score: 8.7 },
      { rank: 2, title: "My Madonna", artist: "Charlie Jeer", score: 8.8 },
      { rank: 3, title: "Molecules", artist: "Charlie Jeer", score: 8.5 },
      { rank: 4, title: "Jennifer", artist: "Charlie Jeer", score: 8.8 },
      { rank: 5, title: "SO GOOD", artist: "Charlie Jeer / Simone Ashley", score: 8.7 },
      { rank: 6, title: "Complications", artist: "Charlie Jeer", score: 9.1 },
      { rank: 7, title: "Florence", artist: "Charlie Jeer", score: 8.7 },
    ],
  },
  "alessia-cara-lah-2025": {
    id: "alessia-cara-lah-2025",
    kicker: "Albums",
    title: "Love & Hyperbole",
    artist: "Alessia Cara",
    year: 2025,
    score: 8.6,
    by: "@charon",
    cover: "./src/media/alessia-cara-lah.jpg",
    review:
      "其实去掉一些很枯燥的诉说和重复的有些歌曲，这张专辑会是一张很好的专辑，或许这也是大多数歌手目前的现状，不是缺好听的歌，而是好的作品被埋在一堆垃圾里面了，太难被发现了，我需要用一个多小时去发现3-4首好的作品，这个成本太高了，所以豪华版的re待定。总的来说还是不错的。评分8.6",
    reviewLimit: 1000,
    tracks: [
      { rank: 1, title: "Go Outside!", artist: "Alessia Cara", score: 8.4 },
      { rank: 2, title: "Left Alone", artist: "Alessia Cara", score: 8.5 },
      { rank: 3, title: "Dead Man", artist: "Alessia Cara", score: 8.8 },
      { rank: 4, title: "Subside", artist: "Alessia Cara", score: 9.2 },
      { rank: 5, title: "Run Run", artist: "Alessia Cara", score: 8.6, explicit: true },
      { rank: 6, title: "Drive", artist: "Alessia Cara", score: 8.5 },
      { rank: 7, title: "Get To You", artist: "Alessia Cara", score: 8.7 },
      { rank: 8, title: "(Isn’t It) Obvious", artist: "Alessia Cara", score: 9.0 },
      { rank: 9, title: "Garden Interlude", artist: "Alessia Cara", score: 8.3 },
      { rank: 10, title: "Nighttime Thing", artist: "Alessia Cara", score: 8.4 },
      { rank: 11, title: "Feels Right", artist: "Alessia Cara", score: 8.3 },
      { rank: 12, title: "Fire", artist: "Alessia Cara", score: 8.5 },
      { rank: 13, title: "Slow Motion", artist: "Alessia Cara", score: 8.8 },
      { rank: 14, title: "Clearly", artist: "Alessia Cara", score: 8.9 },
    ],
  },
};

export const reviewIds = ["charlie-jeer-tamp-2026", "alessia-cara-lah-2025"];
