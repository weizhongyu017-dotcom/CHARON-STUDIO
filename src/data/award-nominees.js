/**
 * Sonic Luminous Award — nominated entries by category.
 * Sort key = artist Latin initial for A–Z display order.
 */
export const AWARD_NOMINEES = {
  "best-music-cover": {
    id: "best-music-cover",
    index: 30,
    zh: "最佳音乐封面",
    en: "Best Music Cover",
    status: "NOMINATED",
    year: 2026,
    nominees: [
      {
        artist: "Ariana Grande",
        work: "petal",
        kind: "album",
        kindZh: "专辑",
        sortKey: "Ariana Grande",
        cover: "./src/media/best-music-cover/ariana-grande-petal.jpg",
      },
      {
        artist: "Charli xcx",
        work: "Music, Fashion, Film",
        kind: "album",
        kindZh: "专辑",
        sortKey: "Charli xcx",
        cover: "./src/media/best-music-cover/charli-xcx-music-fashion-film.jpg",
      },
      {
        artist: "Gracie Abrams",
        work: "Daughter from Hell (Deluxe)",
        kind: "album",
        kindZh: "专辑",
        sortKey: "Gracie Abrams",
        cover: "./src/media/best-music-cover/gracie-abrams-dfh-deluxe.jpg",
      },
      {
        artist: "Lana Del Rey",
        work: "White Feather Hawk Tail Deer Hunter",
        kind: "single",
        kindZh: "单曲",
        sortKey: "Lana Del Rey",
        cover: "./src/media/best-music-cover/lana-del-rey-white-feather.jpg",
      },
      {
        artist: "林忆莲",
        work: "幻觉动物",
        kind: "single",
        kindZh: "单曲",
        sortKey: "Lin Yilian",
        cover: "./src/media/best-music-cover/sandy-lam-huanjue-dongwu.jpg",
      },
      {
        artist: "Olivia Rodrigo",
        work: "you seem pretty sad for a girl so in love",
        kind: "album",
        kindZh: "专辑",
        sortKey: "Olivia Rodrigo",
        cover: "./src/media/best-music-cover/olivia-rodrigo-you-seem-pretty-sad.jpg",
      },
      {
        artist: "RAYE",
        work: "Nightingale Lane.",
        kind: "album",
        kindZh: "专辑",
        sortKey: "RAYE",
        cover: "./src/media/best-music-cover/raye-nightingale-lane.jpg",
      },
      {
        artist: "Ravyn Lenae",
        work: "Blue Island",
        kind: "album",
        kindZh: "专辑",
        sortKey: "Ravyn Lenae",
        cover: "./src/media/best-music-cover/ravyn-lenae-blue-island.jpg",
      },
      {
        artist: "徐佳莹",
        work: "心里学",
        kind: "album",
        kindZh: "专辑",
        sortKey: "Xu Jiaying",
        cover: "./src/media/best-music-cover/lala-hsu-xinlixue.jpg",
      },
      {
        artist: "Zach Bryan",
        work: "Young Manhood and Other Donatable Organs",
        kind: "album",
        kindZh: "专辑",
        sortKey: "Zach Bryan",
        cover: "./src/media/best-music-cover/zach-bryan-young-manhood.jpg",
      },
    ],
  },
};

export function getAwardNominees(id) {
  const pack = AWARD_NOMINEES[id];
  if (!pack) return null;
  const nominees = [...pack.nominees].sort((a, b) =>
    String(a.sortKey).localeCompare(String(b.sortKey), "en", { sensitivity: "base" })
  );
  return { ...pack, nominees };
}
