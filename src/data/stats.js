/**
 * Runtime aggregators over ALL_MONTHS.
 * No new Excel fields — star / FAV tracks / plays only.
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

  const rows = [...map.values()].map((r) => ({
    ...r,
    months: r.months.slice().sort((a, b) => (a.id < b.id ? 1 : -1)),
    isComeback: r.appearances >= 2,
  }));

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
      label: `${peak.labelEn} ${peak.year}`,
    },
    trough: {
      id: trough.id,
      plays: Number(trough.plays) || 0,
      href: monthHref(trough),
      label: `${trough.labelEn} ${trough.year}`,
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
