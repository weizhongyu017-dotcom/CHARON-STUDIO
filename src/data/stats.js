/**
 * Runtime aggregators over ALL_MONTHS.
 * No new Excel fields — star / FAV tracks / plays / album / ranks / season only.
 */

/** Light title normalize so "thank u, next" variants collapse. */
export function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[’']/g, "'")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeArtist(artist) {
  return String(artist || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whole artist string kept (do not split on /) — matches Star reveal logic. */
export function trackKey(title, artist) {
  return `${normalizeTitle(title)}|||${normalizeArtist(artist)}`;
}

export function filterMonths(months, year) {
  if (year == null || year === "ALL" || year === "all") return months;
  const y = Number(year);
  return months.filter((m) => m.year === y);
}

function monthHref(m) {
  const pad = (n) => String(n).padStart(2, "0");
  return `#/monthly-report/${m.year}/${pad(m.month)}`;
}

function monthChip(m) {
  return {
    id: m.id,
    year: m.year,
    month: m.month,
    labelEn: m.labelEn,
    labelZh: m.labelZh,
    href: monthHref(m),
  };
}

/**
 * Star Hall stats keyed by artist string.
 * Sort defaults: count desc, then artMinutesTotal desc.
 */
export function buildStarStats(months, year = "ALL") {
  const list = filterMonths(months, year);
  const map = new Map();

  for (const m of list) {
    const artist = normalizeArtist(m.star?.artist);
    if (!artist) continue;
    const mins = Number(m.star?.artMinutes) || 0;
    let row = map.get(artist);
    if (!row) {
      row = {
        artist,
        count: 0,
        artMinutesTotal: 0,
        artMinutesPeak: 0,
        months: [],
        cover: "",
        coverScore: -1,
        lastId: "",
        lastHref: "",
        favIntersectionMonths: 0,
      };
      map.set(artist, row);
    }
    row.count += 1;
    row.artMinutesTotal += mins;
    if (mins > row.artMinutesPeak) row.artMinutesPeak = mins;
    row.months.push(monthChip(m));
    row.lastId = m.id;
    row.lastHref = monthHref(m);

    const cover = m.star?.cover || "";
    const score = mins;
    if (cover && score >= row.coverScore) {
      row.cover = cover;
      row.coverScore = score;
    }

    const starName = artist;
    const hit = (m.tracks || []).some((t) => {
      const a = String(t.artist || "");
      return a === starName || a.includes(starName);
    });
    if (hit) row.favIntersectionMonths += 1;
  }

  const rows = [...map.values()].map((r) => ({
    ...r,
    artMinutesAvg: r.count ? r.artMinutesTotal / r.count : 0,
    months: r.months.slice().sort((a, b) => (a.id < b.id ? 1 : -1)),
  }));

  rows.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.artMinutesTotal !== a.artMinutesTotal) return b.artMinutesTotal - a.artMinutesTotal;
    return a.artist.localeCompare(b.artist);
  });

  return rows;
}

export function sortStarStats(rows, mode = "count") {
  const out = rows.slice();
  if (mode === "minutes") {
    out.sort((a, b) => {
      if (b.artMinutesTotal !== a.artMinutesTotal) return b.artMinutesTotal - a.artMinutesTotal;
      if (b.count !== a.count) return b.count - a.count;
      return a.artist.localeCompare(b.artist);
    });
  } else {
    out.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      if (b.artMinutesTotal !== a.artMinutesTotal) return b.artMinutesTotal - a.artMinutesTotal;
      return a.artist.localeCompare(b.artist);
    });
  }
  return out;
}

/**
 * FAV track leaderboard.
 * appearances / numberOnes / weighted (5-rank per month).
 */
export function buildTrackStats(months, year = "ALL") {
  const list = filterMonths(months, year);
  const map = new Map();

  for (const m of list) {
    for (const t of m.tracks || []) {
      const key = trackKey(t.title, t.artist);
      if (!key.startsWith("|||") && !normalizeTitle(t.title)) continue;
      let row = map.get(key);
      if (!row) {
        row = {
          key,
          title: t.title,
          artist: t.artist,
          album: t.album || "",
          cover: t.cover || "",
          appearances: 0,
          numberOnes: 0,
          weighted: 0,
          months: [],
          ranks: [],
        };
        map.set(key, row);
      }
      const rank = Number(t.rank) || 4;
      row.appearances += 1;
      if (rank === 1) row.numberOnes += 1;
      row.weighted += Math.max(1, 5 - rank);
      row.months.push(monthChip(m));
      row.ranks.push(rank);
      if (t.cover) row.cover = t.cover;
      if (t.album) row.album = t.album;
      // keep a readable title/artist from latest sighting
      row.title = t.title;
      row.artist = t.artist;
    }
  }

  const rows = [...map.values()].map((r) => {
    const pairs = r.months
      .map((chip, i) => ({ chip, rank: r.ranks[i] }))
      .sort((a, b) => (a.chip.id < b.chip.id ? 1 : -1));
    return {
      ...r,
      months: pairs.map((p) => p.chip),
      ranks: pairs.map((p) => p.rank),
      isComeback: r.appearances >= 2,
    };
  });

  rows.sort((a, b) => {
    if (b.appearances !== a.appearances) return b.appearances - a.appearances;
    if (b.weighted !== a.weighted) return b.weighted - a.weighted;
    return normalizeTitle(a.title).localeCompare(normalizeTitle(b.title));
  });

  return rows;
}

export function sortTrackStats(rows, mode = "appearances") {
  const out = rows.slice();
  if (mode === "numberOnes") {
    out.sort((a, b) => {
      if (b.numberOnes !== a.numberOnes) return b.numberOnes - a.numberOnes;
      if (b.appearances !== a.appearances) return b.appearances - a.appearances;
      return normalizeTitle(a.title).localeCompare(normalizeTitle(b.title));
    });
  } else if (mode === "weighted") {
    out.sort((a, b) => {
      if (b.weighted !== a.weighted) return b.weighted - a.weighted;
      if (b.appearances !== a.appearances) return b.appearances - a.appearances;
      return normalizeTitle(a.title).localeCompare(normalizeTitle(b.title));
    });
  } else {
    out.sort((a, b) => {
      if (b.appearances !== a.appearances) return b.appearances - a.appearances;
      if (b.weighted !== a.weighted) return b.weighted - a.weighted;
      return normalizeTitle(a.title).localeCompare(normalizeTitle(b.title));
    });
  }
  return out;
}

/** Monthly plays series for timeline strip. */
export function buildPlaysSeries(months, year = "ALL") {
  const list = filterMonths(months, year)
    .slice()
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  if (!list.length) {
    return { points: [], peak: null, trough: null, total: 0, maxPlays: 0 };
  }

  let peak = list[0];
  let trough = list[0];
  let total = 0;
  let maxPlays = 0;

  const points = list.map((m) => {
    const plays = Number(m.plays) || 0;
    total += plays;
    if (plays > (Number(peak.plays) || 0)) peak = m;
    if (plays < (Number(trough.plays) || Infinity)) trough = m;
    if (plays > maxPlays) maxPlays = plays;
    return {
      id: m.id,
      year: m.year,
      month: m.month,
      labelEn: m.labelEn,
      labelZh: m.labelZh,
      plays,
      delta: m.delta,
      href: monthHref(m),
      star: m.star?.artist || "",
      cover: m.tracks?.[0]?.cover || m.star?.cover || "",
    };
  });

  return {
    points,
    peak: {
      id: peak.id,
      plays: Number(peak.plays) || 0,
      href: monthHref(peak),
      label: `${peak.labelZh || peak.labelEn} ${peak.year}`,
    },
    trough: {
      id: trough.id,
      plays: Number(trough.plays) || 0,
      href: monthHref(trough),
      label: `${trough.labelZh || trough.labelEn} ${trough.year}`,
    },
    total,
    maxPlays,
  };
}

/** Compact year wrapped summary for archive hub. */
export function yearWrap(months, year) {
  const y = Number(year);
  const list = filterMonths(months, y);
  const stars = buildStarStats(list, y);
  const tracks = buildTrackStats(list, y);
  const plays = buildPlaysSeries(list, y);
  const starKing = stars[0] || null;
  const trackKing = tracks[0] || null;

  return {
    year: y,
    monthCount: list.length,
    starKing: starKing
      ? { artist: starKing.artist, count: starKing.count, cover: starKing.cover }
      : null,
    trackKing: trackKing
      ? {
          title: trackKing.title,
          artist: trackKing.artist,
          appearances: trackKing.appearances,
          cover: trackKing.cover,
        }
      : null,
    peakMonth: plays.peak,
    totalPlays: plays.total,
  };
}

export function normalizeAlbum(album) {
  return String(album || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split collab artist strings for Artist Board only. */
export function splitArtists(artist) {
  const raw = normalizeArtist(artist);
  if (!raw) return [];
  return raw
    .split(/\s*(?:\/|&|,|;|\+| feat\.?| ft\.?| featuring )\s*/i)
    .map((a) => normalizeArtist(a))
    .filter(Boolean);
}

/**
 * Album Hall — aggregate FAV tracks by album name.
 */
export function buildAlbumStats(months, year = "ALL") {
  const list = filterMonths(months, year);
  const map = new Map();

  for (const m of list) {
    for (const t of m.tracks || []) {
      const album = normalizeAlbum(t.album);
      if (!album) continue;
      const key = album.toLowerCase();
      let row = map.get(key);
      if (!row) {
        row = {
          key,
          album: t.album,
          appearances: 0,
          numberOnes: 0,
          weighted: 0,
          artists: new Set(),
          months: [],
          monthIds: new Set(),
          cover: "",
          tracks: new Set(),
        };
        map.set(key, row);
      }
      const rank = Number(t.rank) || 4;
      row.appearances += 1;
      if (rank === 1) row.numberOnes += 1;
      row.weighted += Math.max(1, 5 - rank);
      row.album = t.album;
      if (t.cover) row.cover = t.cover;
      if (t.artist) row.artists.add(normalizeArtist(t.artist));
      if (t.title) row.tracks.add(normalizeTitle(t.title));
      if (!row.monthIds.has(m.id)) {
        row.monthIds.add(m.id);
        row.months.push(monthChip(m));
      }
    }
  }

  const rows = [...map.values()].map((r) => ({
    album: r.album,
    appearances: r.appearances,
    numberOnes: r.numberOnes,
    weighted: r.weighted,
    uniqueMonths: r.monthIds.size,
    artistCount: r.artists.size,
    artists: [...r.artists].slice(0, 4),
    trackCount: r.tracks.size,
    cover: r.cover,
    months: r.months.slice().sort((a, b) => (a.id < b.id ? 1 : -1)),
  }));

  rows.sort((a, b) => {
    if (b.appearances !== a.appearances) return b.appearances - a.appearances;
    if (b.weighted !== a.weighted) return b.weighted - a.weighted;
    return normalizeAlbum(a.album).localeCompare(normalizeAlbum(b.album));
  });

  return rows;
}

export function sortAlbumStats(rows, mode = "appearances") {
  const out = rows.slice();
  if (mode === "numberOnes") {
    out.sort((a, b) => {
      if (b.numberOnes !== a.numberOnes) return b.numberOnes - a.numberOnes;
      if (b.appearances !== a.appearances) return b.appearances - a.appearances;
      return normalizeAlbum(a.album).localeCompare(normalizeAlbum(b.album));
    });
  } else if (mode === "weighted") {
    out.sort((a, b) => {
      if (b.weighted !== a.weighted) return b.weighted - a.weighted;
      if (b.appearances !== a.appearances) return b.appearances - a.appearances;
      return normalizeAlbum(a.album).localeCompare(normalizeAlbum(b.album));
    });
  } else {
    out.sort((a, b) => {
      if (b.appearances !== a.appearances) return b.appearances - a.appearances;
      if (b.weighted !== a.weighted) return b.weighted - a.weighted;
      return normalizeAlbum(a.album).localeCompare(normalizeAlbum(b.album));
    });
  }
  return out;
}

/**
 * Artist Board — FAV credit (split collabs) + Star months.
 */
export function buildArtistBoard(months, year = "ALL") {
  const list = filterMonths(months, year);
  const map = new Map();

  const ensure = (artist) => {
    let row = map.get(artist);
    if (!row) {
      row = {
        artist,
        favAppearances: 0,
        numberOnes: 0,
        weighted: 0,
        starCount: 0,
        artMinutesTotal: 0,
        months: [],
        monthIds: new Set(),
        cover: "",
      };
      map.set(artist, row);
    }
    return row;
  };

  for (const m of list) {
    for (const t of m.tracks || []) {
      const names = splitArtists(t.artist);
      const rank = Number(t.rank) || 4;
      for (const name of names) {
        const row = ensure(name);
        row.favAppearances += 1;
        if (rank === 1) row.numberOnes += 1;
        row.weighted += Math.max(1, 5 - rank);
        if (t.cover) row.cover = t.cover;
        if (!row.monthIds.has(m.id)) {
          row.monthIds.add(m.id);
          row.months.push(monthChip(m));
        }
      }
    }

    const star = normalizeArtist(m.star?.artist);
    if (star) {
      const row = ensure(star);
      row.starCount += 1;
      row.artMinutesTotal += Number(m.star?.artMinutes) || 0;
      if (m.star?.cover) row.cover = m.star.cover;
      if (!row.monthIds.has(m.id)) {
        row.monthIds.add(m.id);
        row.months.push(monthChip(m));
      }
    }
  }

  const rows = [...map.values()].map((r) => ({
    artist: r.artist,
    favAppearances: r.favAppearances,
    numberOnes: r.numberOnes,
    weighted: r.weighted,
    starCount: r.starCount,
    artMinutesTotal: r.artMinutesTotal,
    uniqueMonths: r.monthIds.size,
    cover: r.cover,
    months: r.months.slice().sort((a, b) => (a.id < b.id ? 1 : -1)),
    isStarOnly: r.starCount > 0 && r.favAppearances === 0,
  }));

  rows.sort((a, b) => {
    if (b.weighted !== a.weighted) return b.weighted - a.weighted;
    if (b.favAppearances !== a.favAppearances) return b.favAppearances - a.favAppearances;
    if (b.starCount !== a.starCount) return b.starCount - a.starCount;
    return a.artist.localeCompare(b.artist);
  });

  return rows;
}

export function sortArtistBoard(rows, mode = "weighted") {
  const out = rows.slice();
  if (mode === "fav") {
    out.sort((a, b) => {
      if (b.favAppearances !== a.favAppearances) return b.favAppearances - a.favAppearances;
      if (b.weighted !== a.weighted) return b.weighted - a.weighted;
      return a.artist.localeCompare(b.artist);
    });
  } else if (mode === "star") {
    out.sort((a, b) => {
      if (b.starCount !== a.starCount) return b.starCount - a.starCount;
      if (b.artMinutesTotal !== a.artMinutesTotal) return b.artMinutesTotal - a.artMinutesTotal;
      return a.artist.localeCompare(b.artist);
    });
  } else if (mode === "ones") {
    out.sort((a, b) => {
      if (b.numberOnes !== a.numberOnes) return b.numberOnes - a.numberOnes;
      if (b.weighted !== a.weighted) return b.weighted - a.weighted;
      return a.artist.localeCompare(b.artist);
    });
  } else {
    out.sort((a, b) => {
      if (b.weighted !== a.weighted) return b.weighted - a.weighted;
      if (b.favAppearances !== a.favAppearances) return b.favAppearances - a.favAppearances;
      return a.artist.localeCompare(b.artist);
    });
  }
  return out;
}

function monthIndex(chipOrMonth) {
  const y = Number(chipOrMonth.year);
  const m = Number(chipOrMonth.month);
  return y * 12 + m;
}

function streakFromSortedIds(ids) {
  if (!ids.length) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < ids.length; i++) {
    if (ids[i] === ids[i - 1] + 1) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}

/**
 * Rank Dynamics — streaks, climbs, comeback gaps from FAV ranks.
 */
export function buildRankDynamics(months, year = "ALL") {
  const tracks = buildTrackStats(months, year).filter((t) => t.appearances >= 2);
  const rows = tracks.map((t) => {
    const pairs = t.months
      .map((chip, i) => ({
        chip,
        rank: Number(t.ranks[i]) || 4,
        idx: monthIndex(chip),
      }))
      .slice()
      .sort((a, b) => a.idx - b.idx);

    const boardIds = pairs.map((p) => p.idx);
    const oneIds = pairs.filter((p) => p.rank === 1).map((p) => p.idx);
    const boardStreak = streakFromSortedIds(boardIds);
    const oneStreak = streakFromSortedIds(oneIds);

    let bestClimb = 0;
    for (let i = 1; i < pairs.length; i++) {
      const climb = pairs[i - 1].rank - pairs[i].rank;
      if (climb > bestClimb) bestClimb = climb;
    }

    let maxGap = 0;
    for (let i = 1; i < pairs.length; i++) {
      const gap = pairs[i].idx - pairs[i - 1].idx - 1;
      if (gap > maxGap) maxGap = gap;
    }

    const first = pairs[0];
    const last = pairs[pairs.length - 1];

    return {
      key: t.key,
      title: t.title,
      artist: t.artist,
      cover: t.cover,
      appearances: t.appearances,
      numberOnes: t.numberOnes,
      boardStreak,
      oneStreak,
      bestClimb,
      maxGap,
      firstId: first?.chip?.id || "",
      lastId: last?.chip?.id || "",
      months: t.months,
      ranks: t.ranks,
      isComeback: t.isComeback,
    };
  });

  rows.sort((a, b) => {
    if (b.boardStreak !== a.boardStreak) return b.boardStreak - a.boardStreak;
    if (b.oneStreak !== a.oneStreak) return b.oneStreak - a.oneStreak;
    if (b.bestClimb !== a.bestClimb) return b.bestClimb - a.bestClimb;
    return b.appearances - a.appearances;
  });

  return rows;
}

export function sortRankDynamics(rows, mode = "board") {
  const out = rows.slice();
  if (mode === "ones") {
    out.sort((a, b) => {
      if (b.oneStreak !== a.oneStreak) return b.oneStreak - a.oneStreak;
      if (b.numberOnes !== a.numberOnes) return b.numberOnes - a.numberOnes;
      return b.appearances - a.appearances;
    });
  } else if (mode === "climb") {
    out.sort((a, b) => {
      if (b.bestClimb !== a.bestClimb) return b.bestClimb - a.bestClimb;
      if (b.boardStreak !== a.boardStreak) return b.boardStreak - a.boardStreak;
      return b.appearances - a.appearances;
    });
  } else if (mode === "gap") {
    out.sort((a, b) => {
      if (b.maxGap !== a.maxGap) return b.maxGap - a.maxGap;
      if (b.appearances !== a.appearances) return b.appearances - a.appearances;
      return normalizeTitle(a.title).localeCompare(normalizeTitle(b.title));
    });
  } else {
    out.sort((a, b) => {
      if (b.boardStreak !== a.boardStreak) return b.boardStreak - a.boardStreak;
      if (b.oneStreak !== a.oneStreak) return b.oneStreak - a.oneStreak;
      return b.appearances - a.appearances;
    });
  }
  return out;
}

export function seasonOfMonth(month) {
  const m = Number(month);
  if (m === 12 || m === 1 || m === 2) return "winter";
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  return "autumn";
}

export function halfOfMonth(month) {
  return Number(month) <= 6 ? "H1" : "H2";
}

const SEASON_META = {
  spring: { id: "spring", labelEn: "Spring", labelZh: "春", months: "3–5 月" },
  summer: { id: "summer", labelEn: "Summer", labelZh: "夏", months: "6–8 月" },
  autumn: { id: "autumn", labelEn: "Autumn", labelZh: "秋", months: "9–11 月" },
  winter: { id: "winter", labelEn: "Winter", labelZh: "冬", months: "12–2 月" },
};

/**
 * Season / half-year rolls from plays + star + FAV.01.
 */
export function buildSeasonStats(months, year = "ALL") {
  const list = filterMonths(months, year);
  const seasonMap = new Map();
  const halfMap = new Map();

  const bump = (map, key, meta, m) => {
    let row = map.get(key);
    if (!row) {
      row = {
        id: meta.id,
        key,
        labelEn: meta.labelEn,
        labelZh: meta.labelZh,
        monthsLabel: meta.months,
        monthCount: 0,
        totalPlays: 0,
        stars: new Map(),
        tracks: new Map(),
        months: [],
      };
      map.set(key, row);
    }
    row.monthCount += 1;
    row.totalPlays += Number(m.plays) || 0;
    row.months.push(monthChip(m));

    const star = normalizeArtist(m.star?.artist);
    if (star) {
      const s = row.stars.get(star) || { artist: star, count: 0, cover: "" };
      s.count += 1;
      if (m.star?.cover) s.cover = m.star.cover;
      row.stars.set(star, s);
    }

    const top = m.tracks?.[0];
    if (top?.title) {
      const tk = trackKey(top.title, top.artist);
      const t = row.tracks.get(tk) || {
        key: tk,
        title: top.title,
        artist: top.artist,
        count: 0,
        cover: top.cover || "",
      };
      t.count += 1;
      if (top.cover) t.cover = top.cover;
      row.tracks.set(tk, t);
    }
  };

  for (const m of list) {
    const season = seasonOfMonth(m.month);
    bump(seasonMap, season, SEASON_META[season], m);
    const half = halfOfMonth(m.month);
    bump(
      halfMap,
      half,
      {
        id: half,
        labelEn: half === "H1" ? "First half" : "Second half",
        labelZh: half === "H1" ? "上半年" : "下半年",
        months: half === "H1" ? "1–6 月" : "7–12 月",
      },
      m
    );
  }

  const finalize = (row) => {
    const topStar = [...row.stars.values()].sort((a, b) => b.count - a.count)[0] || null;
    const topTrack = [...row.tracks.values()].sort((a, b) => b.count - a.count)[0] || null;
    return {
      id: row.id,
      key: row.key,
      labelEn: row.labelEn,
      labelZh: row.labelZh,
      monthsLabel: row.monthsLabel,
      monthCount: row.monthCount,
      totalPlays: row.totalPlays,
      avgPlays: row.monthCount ? Math.round(row.totalPlays / row.monthCount) : 0,
      topStar,
      topTrack,
      cover: topTrack?.cover || topStar?.cover || "",
      months: row.months.slice().sort((a, b) => (a.id < b.id ? -1 : 1)),
    };
  };

  const order = ["spring", "summer", "autumn", "winter"];
  const seasons = order
    .map((id) => seasonMap.get(id))
    .filter(Boolean)
    .map(finalize);

  const halves = ["H1", "H2"]
    .map((id) => halfMap.get(id))
    .filter(Boolean)
    .map(finalize);

  return { seasons, halves };
}
