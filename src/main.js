import { startField } from "./field.js?v=62";
import {
  HOME_PALETTE,
  paletteFromCoverDeep,
  paletteFromHomeTrack,
  paletteFromHues,
  paletteFromTracks,
} from "./palette.js?v=62";
import {
  ALL_MONTHS,
  LATEST_MONTH,
  YEAR_MAP,
  YEARS,
  findMonth,
  monthsForYear,
} from "./data/catalog.js?v=62";
import {
  buildAlbumStats,
  buildArtistBoard,
  buildPlaysSeries,
  buildRankDynamics,
  buildSeasonStats,
  buildStarStats,
  buildTrackStats,
  sortAlbumStats,
  sortArtistBoard,
  sortRankDynamics,
  sortStarStats,
  sortTrackStats,
  yearWrap,
} from "./data/stats.js?v=97";
import { monthlyNewsIds, newsItems } from "./data/news.js?v=98";
import { reviewIds, reviewItems } from "./data/reviews.js?v=62";
import {
  AWARD_EDITION,
  SINGLE_AWARDS,
  SPECIAL_AWARDS,
} from "./data/awards.js?v=76";
import { bindDiscGallery } from "./disc-gallery-three.js?v=72";

const app = document.querySelector("#app");
const field = startField(document.querySelector("#field"));
let destroyDiscRail = null;

const LATEST = LATEST_MONTH;
const CURRENT_FAV = LATEST?.tracks?.[0] || null;
const MONTHLY_NEWS = monthlyNewsIds
  .map((id) => newsItems[id])
  .filter(Boolean);
const LATEST_NEWS = MONTHLY_NEWS[0] || null;
const ALBUM_REVIEWS = reviewIds.map((id) => reviewItems[id]).filter(Boolean);
const LATEST_REVIEW = ALBUM_REVIEWS[0] || null;
const YEAR_LIST = YEARS.map((y) => y.year);

function findNews(id) {
  return newsItems[id] || null;
}

function findReview(id) {
  return reviewItems[id] || null;
}

const paletteCache = new Map();

function path() {
  const hash = location.hash.replace(/^#/, "") || "/";
  return hash.startsWith("/") ? hash : `/${hash}`;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function escapeAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatArtTime(minutes) {
  const m = Number(minutes) || 0;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h <= 0) return `${m} min`;
  return `${h}h ${pad(rem)}m`;
}

function formatDelta(delta) {
  if (delta == null || Number.isNaN(delta)) return "—";
  const pct = Math.round(delta * 100);
  return `${pct > 0 ? "+" : ""}${pct}% vs last month`;
}

function formatDeltaShort(delta) {
  if (delta == null || Number.isNaN(delta)) return "—";
  const pct = Math.round(delta * 100);
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function coverUrl(url, size = 600) {
  if (!url) return "";
  return String(url).replace(/\/\d+x\d+bb(\.[a-z]+)$/i, `/${size}x${size}bb$1`);
}

function creditLine(month) {
  if (month?.listener && month?.source) {
    return `${month.listener} / ${month.source}`;
  }
  return "CHARON / STUDIO";
}

function starFavTracks(month) {
  const star = String(month.star?.artist || "").trim();
  if (!star) return [];
  return month.tracks.filter((t) => {
    const artists = String(t.artist || "")
      .split(/[/&|,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    return artists.includes(star) || String(t.artist).includes(star);
  });
}

function starMonthBlock(month, top) {
  const hits = starFavTracks(month);
  const hitCards = hits
    .map(
      (t) => `
      <article class="star-fav-card">
        <p class="star-fav-rank">FAV.${pad(t.rank)}</p>
        <h4 class="star-fav-title">${escapeHtml(t.title)}</h4>
      </article>
    `
    )
    .join("");

  return `
    <article class="track star-in-month is-open">
      <div class="track-head star-head-static" role="group" aria-label="Monthly star">
        <span class="rank">★</span>
        <span class="track-artist">${escapeHtml(month.star.artist)}</span>
      </div>
      <div class="track-drawer">
        <div class="track-drawer-inner star-reveal">
          <div class="track-cover star-cover">
            <img src="${coverUrl(month.star.cover || top.cover)}" alt="${escapeAttr(month.star.artist)}" loading="lazy" />
          </div>
          <div class="star-art-panel">
            <p class="track-kicker">本月最佳歌手 ‣ FAV ART</p>
            <h3>${escapeHtml(month.star.artist)}</h3>
            <p class="star-art-time">${formatArtTime(month.star.artMinutes)}</p>
            <p class="track-meta">${month.star.artMinutes} min</p>
          </div>
          ${hits.length ? `<div class="star-fav-rail">${hitCards}</div>` : ""}
        </div>
      </div>
    </article>
  `;
}

function parseArchiveQuery(search) {
  const q = new URLSearchParams(search || "");
  const yearRaw = q.get("year");
  const year =
    yearRaw && yearRaw.toUpperCase() === "ALL"
      ? "ALL"
      : YEAR_MAP[Number(yearRaw)]
        ? Number(yearRaw)
        : "ALL";
  return {
    year,
    sort: q.get("sort") || "",
    limit: Number(q.get("limit")) || 0,
  };
}

function parseRoute() {
  const raw = path();
  const [p, query = ""] = raw.split("?");
  if (p === "/" || p === "") return { name: "home" };
  const reviewDetail = p.match(/^\/album-review\/([^/]+)$/);
  if (reviewDetail) {
    return { name: "review-detail", id: decodeURIComponent(reviewDetail[1]) };
  }
  if (p === "/album-review" || p === "/album-review/") {
    return { name: "review-index" };
  }
  const newsDetail = p.match(/^\/monthly-news\/([^/]+)$/);
  if (newsDetail) {
    return { name: "news-detail", id: decodeURIComponent(newsDetail[1]) };
  }
  if (p === "/monthly-news" || p === "/monthly-news/") {
    return { name: "news-index" };
  }

  if (
    p === "/sonic-luminous-award" ||
    p === "/sonic-luminous-award/" ||
    p === "/award" ||
    p === "/award/"
  ) {
    return { name: "award" };
  }

  if (p === "/archive" || p === "/archive/") {
    return { name: "archive", ...parseArchiveQuery(query) };
  }
  if (p === "/archive/stars" || p === "/archive/stars/") {
    return { name: "archive-stars", ...parseArchiveQuery(query) };
  }
  if (p === "/archive/tracks" || p === "/archive/tracks/") {
    return { name: "archive-tracks", ...parseArchiveQuery(query) };
  }
  if (p === "/archive/plays" || p === "/archive/plays/") {
    return { name: "archive-plays", ...parseArchiveQuery(query) };
  }
  if (p === "/archive/albums" || p === "/archive/albums/") {
    return { name: "archive-albums", ...parseArchiveQuery(query) };
  }
  if (p === "/archive/artists" || p === "/archive/artists/") {
    return { name: "archive-artists", ...parseArchiveQuery(query) };
  }
  if (p === "/archive/ranks" || p === "/archive/ranks/") {
    return { name: "archive-ranks", ...parseArchiveQuery(query) };
  }
  if (p === "/archive/seasons" || p === "/archive/seasons/") {
    return { name: "archive-seasons", ...parseArchiveQuery(query) };
  }

  if (p === "/monthly-report" || p === "/monthly-report/") {
    return { name: "report-index", year: LATEST.year };
  }
  const starYear = p.match(/^\/monthly-report\/star\/(\d{4})$/);
  if (starYear) {
    const year = Number(starYear[1]);
    if (YEAR_MAP[year]) return { name: "star", year };
  }
  if (p === "/monthly-report/star" || p === "/monthly-star") {
    return { name: "star", year: LATEST.year };
  }
  const yearOnly = p.match(/^\/monthly-report\/(\d{4})$/);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    if (YEAR_MAP[year]) return { name: "report-index", year };
  }
  const monthMatch = p.match(/^\/monthly-report\/(\d{4})\/(\d{1,2})$/);
  if (monthMatch) {
    return {
      name: "month",
      year: Number(monthMatch[1]),
      month: Number(monthMatch[2]),
    };
  }
  return { name: "home" };
}

function header(page) {
  const archiveOn = page === "archive" || String(page).startsWith("archive");
  const reportOn = page === "report" || page === "star";
  return `
    <header class="site-header">
      <a class="wordmark" href="#/" aria-label="CHARON STUDIO home">CHARON <i></i> <span>studio</span></a>
      <nav class="nav-cols" aria-label="Primary">
        <ul class="nav-list">
          <li><a href="#/monthly-news" class="${page === "news" ? "is-active" : ""}">Monthly News</a></li>
          <li><a href="#/album-review" class="${page === "review" ? "is-active" : ""}">New Album Review</a></li>
          <li><a href="#/monthly-report" class="${reportOn ? "is-active" : ""}">Monthly Report</a></li>
          <li><a href="#/archive" class="${archiveOn ? "is-active" : ""}">Archive</a></li>
        </ul>
      </nav>
    </header>
  `;
}

function reportModeSwitcher(mode, year) {
  const y = YEAR_MAP[year] ? year : LATEST.year;
  return `
    <span class="month-switch-label">VIEW</span>
    <div class="month-chips report-mode-chips">
      <a class="month-chip ${mode === "discs" ? "is-active" : ""}" href="#/monthly-report/${y}">Discs</a>
      <a class="month-chip ${mode === "star" ? "is-active" : ""}" href="#/monthly-report/star/${y}">Star</a>
    </div>
  `;
}

function archiveSwitcher(activeYear, activeMonthId) {
  const yearLinks = YEAR_LIST.map((y) => {
    const active = y === activeYear ? "is-active" : "";
    return `<a class="month-chip ${active}" href="#/monthly-report/${y}">${y}</a>`;
  }).join("");

  const months = monthsForYear(activeYear);
  const monthLinks = months
    .map((m) => {
      const href = `#/monthly-report/${m.year}/${pad(m.month)}`;
      const active = m.id === activeMonthId ? "is-active" : "";
      return `<a class="month-chip ${active}" href="${href}">${pad(m.month)}</a>`;
    })
    .join("");

  return `
    <nav class="month-switch archive-switch" aria-label="Archive">
      <span class="month-switch-label">YEAR</span>
      <div class="month-chips">${yearLinks}</div>
      <span class="month-switch-label month-switch-gap">MONTH</span>
      <div class="month-chips">${monthLinks}</div>
    </nav>
  `;
}

function newsPosterView(item, opts = {}) {
  const alt = [item.title, item.subtitle, item.venue, item.date].filter(Boolean).join(" · ");
  const split = item.posterFit === "split" || item.posterFit === "contain";
  const dense = Array.isArray(item.noms) && item.noms.length >= 9;
  const tone = [
    item.tone === "crimson" ? "is-crimson" : "",
    item.lettered ? "is-lettered" : "",
    split ? "is-split" : "",
    item.imageOrient === "landscape" ? "is-landscape" : "",
    dense ? "is-noms-dense" : "",
  ]
    .filter(Boolean)
    .map((c) => ` ${c}`)
    .join("");
  const pos = item.objectPosition
    ? ` style="--news-pos: ${escapeAttr(item.objectPosition)}"`
    : "";
  const anchor = opts.first ? ' id="now"' : "";
  const noms = Array.isArray(item.noms) && item.noms.length
    ? `<ol class="news-noms">${item.noms
        .map(
          (n, i) => `
        <li class="news-noms-item">
          <span class="news-noms-index">${pad(i + 1)}</span>
          <div class="news-noms-copy">
            <p class="news-noms-cat">${escapeHtml(n.cat)}</p>
            ${
              n.work
                ? `<p class="news-noms-work">${escapeHtml(n.work)}</p>`
                : ""
            }
          </div>
        </li>`
        )
        .join("")}</ol>`
    : "";
  const cornerName =
    item.namePlacement === "corner" && item.subtitle
      ? `<p class="news-poster-corner-name">${escapeHtml(item.subtitle)}</p>`
      : "";
  const subLine =
    item.namePlacement === "corner"
      ? ""
      : `<p class="news-poster-sub">${escapeHtml(item.subtitle || "")}</p>`;
  const copy = item.lettered
    ? ""
    : `
      <div class="news-poster-copy${noms ? " has-noms" : ""}">
        <p class="kicker">${escapeHtml(item.kicker)}</p>
        <p class="news-poster-date">${escapeHtml(item.date)}</p>
        <h2 class="news-poster-title">
          <span class="news-poster-title-zh">${escapeHtml(item.title)}</span>
          <span class="news-poster-title-en">${escapeHtml(item.titleEn || "")}</span>
        </h2>
        ${subLine}
        <div class="news-poster-venue">
          <span>${escapeHtml(item.venue || "")}</span>
          <span>${escapeHtml(item.venueEn || "")}</span>
        </div>
        ${noms}
        ${
          item.note
            ? `<p class="news-poster-note">${escapeHtml(item.note)}</p>`
            : ""
        }
      </div>
    `;
  return `
    <article${anchor} class="home-news home-news-poster${tone}" aria-label="${escapeAttr(item.kicker || "Monthly News")}">
      <div class="news-poster-media"${pos}>
        <img src="${escapeAttr(item.image)}" alt="${escapeAttr(alt)}" loading="${opts.first ? "eager" : "lazy"}" />
        ${split ? "" : `<div class="news-poster-veil" aria-hidden="true"></div>`}
      </div>
      ${cornerName}
      ${copy}
    </article>
  `;
}

function newsTrackView(item, opts = {}) {
  const track = CURRENT_FAV;
  const anchor = opts.first ? ' id="now"' : "";
  if (!track) {
    return `
      <article${anchor} class="home-news home-news-track" aria-label="Monthly News">
        <p class="kicker">${escapeHtml(item.kicker)}</p>
        <p class="index-sub">No monthly best track yet.</p>
      </article>
    `;
  }
  const rating = item.rating == null ? "—" : String(item.rating);
  const metas = (item.metaPlaceholders || [])
    .map(
      (m) => `
      <div class="news-track-stat">
        <dt>${escapeHtml(m.label)}</dt>
        <dd>${escapeHtml(m.value)}</dd>
      </div>
    `
    )
    .join("");

  return `
    <article${anchor} class="home-news home-news-track" aria-label="Monthly News">
      <div class="news-track-grid">
        <figure class="news-track-cover">
          <img src="${coverUrl(track.cover, 800)}" alt="${escapeAttr(track.title)} cover" />
        </figure>
        <div class="news-track-panel">
          <p class="kicker">${escapeHtml(item.kicker)}</p>
          <p class="news-track-month">${LATEST.labelZh} ${LATEST.year} ‣ FAV.01</p>
          <h2 class="news-track-title">${escapeHtml(track.title)}</h2>
          <p class="news-track-artist">${escapeHtml(track.artist)}</p>
          <p class="news-track-album">${escapeHtml(track.album || "—")}</p>
          <div class="news-track-score">
            <span class="news-track-score-label">${escapeHtml(item.scoreLabel || "Score")}</span>
            <span class="news-track-score-num">${escapeHtml(rating)}</span>
          </div>
          <dl class="news-track-meta">${metas}</dl>
          <a class="news-track-link" href="#/monthly-report/${LATEST.year}/${pad(LATEST.month)}">Open monthly report →</a>
        </div>
      </div>
    </article>
  `;
}

function newsReleaseView(item, opts = {}) {
  const anchor = opts.first ? ' id="now"' : "";
  return `
    <article${anchor} class="home-news home-news-release" aria-label="Monthly News">
      <p class="kicker">${escapeHtml(item.kicker || "Release ‣ Soon")}</p>
      <h2 class="news-release-title">${escapeHtml(item.title || "Untitled")}</h2>
      <p class="news-release-meta">${escapeHtml(item.artist || "")}</p>
      <p class="news-release-meta">${escapeHtml(item.date || "")}</p>
      <p class="index-sub">${escapeHtml(item.blurb || "Details coming soon.")}</p>
    </article>
  `;
}

function newsItemView(item, index) {
  const opts = { first: index === 0 };
  if (item.type === "poster") return newsPosterView(item, opts);
  if (item.type === "release") return newsReleaseView(item, opts);
  return newsTrackView(item, opts);
}

function homeNewsView() {
  if (!LATEST_NEWS) return "";
  // Home teaser: contain posters stay full-frame; else prefer square cover + readable overlay.
  const teaser = {
    ...LATEST_NEWS,
    lettered: false,
    image: LATEST_NEWS.homeImage || LATEST_NEWS.image,
    objectPosition: LATEST_NEWS.homeImage ? "50% 35%" : LATEST_NEWS.objectPosition,
  };
  return `
    <section class="monthly-news" aria-label="Latest Monthly News">
      ${newsItemView(teaser, 0)}
      <div class="news-home-more">
        <a class="archive-latest" href="#/monthly-news/${encodeURIComponent(LATEST_NEWS.id)}">Open full story →</a>
        <a class="archive-latest" href="#/monthly-news">All Monthly News →</a>
      </div>
    </section>
  `;
}

function newsIndexView() {
  document.title = "MONTHLY NEWS — CHARON STUDIO";
  document.body.dataset.page = "news";
  field.setMode(1);
  field.setPalette(paletteCache.get("home") || HOME_PALETTE);

  const cards = MONTHLY_NEWS.map((item, i) => {
    const thumb =
      item.image ||
      (item.type === "track" ? CURRENT_FAV?.cover : "") ||
      "";
    const blurb = [item.subtitle, item.venue || item.note].filter(Boolean).join(" · ");
    return `
      <a class="news-card" href="#/monthly-news/${encodeURIComponent(item.id)}">
        <div class="news-card-cover">
          ${
            thumb
              ? `<img src="${escapeAttr(item.lettered ? thumb : coverUrl(thumb))}" alt="${escapeAttr(item.title)} cover" loading="lazy" />`
              : `<div class="news-card-fallback" aria-hidden="true"></div>`
          }
        </div>
        <div class="news-card-meta">
          <p class="kicker">${escapeHtml(item.kicker || `News ‣ ${pad(i + 1)}`)}</p>
          <p class="news-card-date">${escapeHtml(item.date || "")}</p>
          <h2>${escapeHtml(item.title)}</h2>
          <p class="track-meta">${escapeHtml(item.titleEn || "")}</p>
          <p class="track-meta">${escapeHtml(blurb)}</p>
        </div>
      </a>
    `;
  }).join("");

  return `
    ${header("news")}
    <main class="report news-index">
      <div class="archive-lead">
        <p class="kicker">Monthly News</p>
        <p class="archive-lead-sub">${MONTHLY_NEWS.length} dispatches</p>
      </div>
      <section class="month-grid news-grid">${cards}</section>
      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>News archive</span>
      </footer>
    </main>
  `;
}

function newsDetailView(item) {
  document.title = `${item.title} — MONTHLY NEWS — CHARON STUDIO`;
  document.body.dataset.page = "news";
  field.setMode(1);
  field.setPalette(paletteCache.get("home") || HOME_PALETTE);

  return `
    ${header("news")}
    <main class="news-detail">
      <div class="news-detail-bar">
        <a class="archive-latest" href="#/monthly-news">← All news</a>
        <p class="kicker">${escapeHtml(item.date || "")}</p>
      </div>
      ${newsItemView(item, 0)}
    </main>
  `;
}

function formatScore(score) {
  const n = Number(score);
  if (Number.isNaN(n)) return "—";
  return n.toFixed(1);
}

function reviewHero(item) {
  return `
    <section class="review-hero" aria-label="Album overview">
      <div class="review-hero-grid">
        <div class="review-hero-copy">
          <p class="review-kicker">${escapeHtml(item.kicker || "Track Albums")}</p>
          <h1 class="review-title">${escapeHtml(item.title)}</h1>
          <p class="review-artist">${escapeHtml(item.artist)}</p>
          <p class="review-year">${escapeHtml(String(item.year || ""))}</p>
        </div>
        <figure class="review-cover">
          <img src="${escapeAttr(item.cover)}" alt="${escapeAttr(item.title)} cover" />
        </figure>
        <div class="review-score-wrap" aria-label="Album score ${formatScore(item.score)}">
          <span class="review-score-ring">${formatScore(item.score)}</span>
        </div>
      </div>
      <p class="review-by">By ${escapeHtml(item.by || "@charon")}</p>
      <button type="button" class="review-scroll-hint" data-scroll-to="review-scores">Scroll ‣ Track Scores</button>
    </section>
  `;
}

function bindReviewScroll() {
  document.querySelectorAll("[data-scroll-to]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-scroll-to");
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function reviewTracks(item) {
  const rows = (item.tracks || [])
    .map(
      (t) => `
      <li class="review-track-row">
        <span class="review-track-num">${pad(t.rank)}</span>
        <div class="review-track-main">
          <p class="review-track-title">${t.explicit ? `<span class="review-explicit" aria-label="Explicit">E</span>` : ""}${escapeHtml(t.title)}</p>
          <p class="review-track-artist">${escapeHtml(t.artist)}</p>
        </div>
        <span class="review-track-score" aria-label="Score ${formatScore(t.score)}">${formatScore(t.score)}</span>
      </li>
    `
    )
    .join("");

  return `
    <section id="review-scores" class="review-scores" aria-label="Track scores">
      <header class="review-section-head">
        <h2>Track Scores</h2>
      </header>
      <ol class="review-track-list">${rows}</ol>
    </section>
  `;
}

function reviewBody(item) {
  const text = item.review || "";
  const limit = item.reviewLimit || 1000;
  return `
    <section class="review-body" aria-label="Review">
      <header class="review-section-head">
        <h2>Review</h2>
        <span class="review-count">${text.length}/${limit}</span>
      </header>
      <div class="review-text">${escapeHtml(text)}</div>
    </section>
  `;
}

function rgbCss(rgb, alpha = 1) {
  const r = Math.round((rgb?.[0] || 0) * 255);
  const g = Math.round((rgb?.[1] || 0) * 255);
  const b = Math.round((rgb?.[2] || 0) * 255);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function applyReviewTheme(colors) {
  const page = document.querySelector(".review-page");
  if (!page || !colors || colors.length < 4) return;
  page.style.setProperty("--rv0", rgbCss(colors[0], 1));
  page.style.setProperty("--rv1", rgbCss(colors[1], 1));
  page.style.setProperty("--rv2", rgbCss(colors[2], 1));
  page.style.setProperty("--rv3", rgbCss(colors[3], 1));
  page.style.setProperty("--rv-glow", rgbCss(colors[3], 0.28));
  page.style.setProperty("--rv-panel", rgbCss(colors[0], 0.4));
  page.style.setProperty("--rv-line", rgbCss(colors[2], 0.26));
  page.style.setProperty("--rv-ring", rgbCss(colors[3], 0.82));
}

async function ensureReviewPalette(item) {
  const key = `review-deep-${item.id}`;
  if (paletteCache.has(key)) return paletteCache.get(key);
  const colors = await paletteFromCoverDeep(item.cover);
  paletteCache.set(key, colors);
  return colors;
}

function reviewDetailView(item) {
  document.title = `${item.title} — NEW ALBUM REVIEW — CHARON STUDIO`;
  document.body.dataset.page = "review";
  field.setMode(1);
  const cached = paletteCache.get(`review-${item.id}`);
  field.setPalette(cached || HOME_PALETTE);

  return `
    ${header("review")}
    <main class="review-page">
      <div class="review-aura" aria-hidden="true"></div>
      ${reviewHero(item)}
      <div class="review-content">
        ${reviewTracks(item)}
        ${reviewBody(item)}
        <footer class="site-footer review-footer">
          <span>CHARON STUDIO</span>
          <a class="archive-latest" href="#/album-review">All reviews →</a>
        </footer>
      </div>
    </main>
  `;
}

function reviewIndexView() {
  document.title = "NEW ALBUM REVIEW — CHARON STUDIO";
  document.body.dataset.page = "review";
  field.setMode(1);
  field.setPalette(paletteCache.get("home") || HOME_PALETTE);

  if (ALBUM_REVIEWS.length === 1) {
    return reviewDetailView(ALBUM_REVIEWS[0]);
  }

  const cards = ALBUM_REVIEWS.map(
    (item) => `
      <a class="review-index-card" href="#/album-review/${encodeURIComponent(item.id)}">
        <div class="review-index-cover">
          <img src="${escapeAttr(item.cover)}" alt="${escapeAttr(item.title)} cover" loading="lazy" />
        </div>
        <div class="review-index-meta">
          <p class="kicker">${escapeHtml(item.kicker || "Track Albums")}</p>
          <h2>${escapeHtml(item.title)}</h2>
          <p class="track-meta">${escapeHtml(item.artist)} · ${escapeHtml(String(item.year || ""))}</p>
          <p class="review-index-score">${formatScore(item.score)}</p>
        </div>
      </a>
    `
  ).join("");

  return `
    ${header("review")}
    <main class="report review-index">
      <div class="archive-lead">
        <p class="kicker">New Album Review</p>
        <p class="archive-lead-sub">${ALBUM_REVIEWS.length} albums</p>
      </div>
      <section class="month-grid">${cards}</section>
      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>Album reviews</span>
      </footer>
    </main>
  `;
}

function awardView() {
  document.title = `${AWARD_EDITION.title}(${AWARD_EDITION.year}) — CHARON STUDIO`;
  document.body.dataset.page = "award";
  field.setMode(0.35);

  const singles = SINGLE_AWARDS.map(
    (a, i) => `
    <li class="award-item">
      <span class="award-index">${pad(i + 1)}</span>
      <h3 class="award-zh">${escapeHtml(a.zh)}</h3>
      <p class="award-en">${escapeHtml(a.en)}</p>
    </li>`
  ).join("");

  const specials = SPECIAL_AWARDS.map(
    (a, i) => `
    <li class="award-item award-item-special">
      <span class="award-index">${pad(i + 1)}</span>
      <h3 class="award-zh">${escapeHtml(a.zh)}</h3>
      <p class="award-en">${escapeHtml(a.en)}</p>
      ${a.count ? `<p class="award-count"><span>${a.count}</span> seats</p>` : ""}
    </li>`
  ).join("");

  return `
    ${header("award")}
    <main class="award-page">
      <header class="award-hero">
        <p class="kicker">${escapeHtml(AWARD_EDITION.studio)} ‣ Awards</p>
        <h1 class="award-title">
          <span class="award-title-main">${escapeHtml(AWARD_EDITION.title)}</span>
          <span class="award-title-year">(${AWARD_EDITION.year})</span>
        </h1>
      </header>

      <section class="award-section" aria-labelledby="award-single">
        <div class="award-section-head">
          <p class="kicker" id="award-single">单项 ‣ Singles</p>
        </div>
        <ol class="award-list">${singles}</ol>
      </section>

      <section class="award-section" aria-labelledby="award-special">
        <div class="award-section-head">
          <p class="kicker" id="award-special">专项 ‣ Specials</p>
        </div>
        <ol class="award-list award-list-special">${specials}</ol>
      </section>

      <footer class="site-footer award-footer">
        <span>${escapeHtml(AWARD_EDITION.studio)}</span>
        <span>${escapeHtml(AWARD_EDITION.title)}(${AWARD_EDITION.year})</span>
      </footer>
    </main>
  `;
}

function homeView() {
  document.title = "CHARON STUDIO";
  document.body.dataset.page = "home";
  field.setMode(0);
  field.setPalette(paletteCache.get("home") || HOME_PALETTE);
  const letters = [..."CHARON STUDIO"].map((ch) =>
    ch === " " ? `<span class="gap" aria-hidden="true"></span>` : `<span>${ch}</span>`
  );
  return `
    ${header("home")}
    <main class="home-shell">
      <section class="home home-hero">
        <h1 class="home-mast" aria-label="CHARON STUDIO">${letters.join("")}</h1>
        <p class="home-scroll-hint" aria-hidden="true">Scroll ‣ Latest</p>
        <a class="home-now-jump" href="#now">Latest ↓</a>
        ${
          LATEST_NEWS
            ? `<a class="home-latest-chip" href="#now">${escapeHtml(LATEST_NEWS.subtitle || LATEST_NEWS.title)} · ${escapeHtml(LATEST_NEWS.date || "")}</a>`
            : ""
        }
      </section>
      ${homeNewsView()}
    </main>
  `;
}

function fitMast() {
  const mast = document.querySelector(".home-mast");
  if (!mast) return;
  const max = Math.min(window.innerWidth * 0.16, window.innerHeight * 0.36);
  const min = 64;
  let lo = min;
  let hi = max;
  const measure = (size) => {
    mast.style.fontSize = `${size}px`;
    mast.style.justifyContent = "flex-start";
    mast.style.columnGap = "0px";
    return [...mast.children].reduce((sum, el) => sum + el.getBoundingClientRect().width, 0);
  };
  const available = mast.clientWidth;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (measure(mid) <= available * 0.92) lo = mid;
    else hi = mid;
  }
  mast.style.fontSize = `${Math.floor(lo)}px`;
  mast.style.justifyContent = "space-between";
  mast.style.columnGap = "";
}

function reportDiscItems(focusYear) {
  const months = ALL_MONTHS;
  let startIndex = months.findIndex(
    (m) => m.year === LATEST.year && m.month === LATEST.month
  );
  if (YEAR_MAP[focusYear]) {
    const yearFirst = months.findIndex((m) => m.year === focusYear);
    if (yearFirst >= 0) startIndex = yearFirst;
    if (focusYear === LATEST.year) {
      const latest = months.findIndex(
        (m) => m.year === LATEST.year && m.month === LATEST.month
      );
      if (latest >= 0) startIndex = latest;
    }
  }
  if (startIndex < 0) startIndex = Math.max(0, months.length - 1);
  return { months, startIndex };
}

function reportIndexView(year) {
  const y = YEAR_MAP[year] ? year : LATEST.year;
  const { months, startIndex } = reportDiscItems(y);
  const focus = months[startIndex] || LATEST;
  const focusTrack = focus.tracks?.[0];
  document.title = `MONTHLY REPORT — CHARON STUDIO`;
  document.body.dataset.page = "report-discs";
  field.setMode(0.35);

  const yearJumps = YEAR_LIST.map((yr) => {
    const active = yr === y ? "is-active" : "";
    return `<button type="button" class="month-chip ${active}" data-jump-year="${yr}">${yr}</button>`;
  }).join("");

  return `
    ${header("report")}
    <main class="report report-discs" data-start-index="${startIndex}">
      <div class="disc-grain" aria-hidden="true"></div>
      <nav class="month-switch archive-switch disc-year-nav" aria-label="Monthly report views">
        ${reportModeSwitcher("discs", y)}
        <span class="month-switch-label">YEAR</span>
        <div class="month-chips">${yearJumps}</div>
        <span class="disc-hint">Scroll · Hover · Click</span>
      </nav>

      <section class="disc-stage" aria-label="Monthly favourite discs">
        <div class="disc-viewport"></div>
      </section>

      <footer class="disc-foot" aria-live="polite">
        <div class="disc-meta">
          <p class="disc-meta-kicker">Monthly Report</p>
          <h1 class="disc-meta-title" data-disc-title>${escapeHtml(focusTrack?.title || "")}</h1>
          <p class="disc-quote" data-disc-quote>${escapeHtml(`${focus.labelEn.toUpperCase()} · ${focus.plays} PLAYS`)}</p>
          <dl class="disc-meta-list">
            <div><dt>Artist</dt><dd data-disc-artist>${escapeHtml(focusTrack?.artist || "")}</dd></div>
            <div><dt>Year</dt><dd data-disc-year>${focus.year}</dd></div>
            <div><dt>Month</dt><dd data-disc-month>${escapeHtml(`${focus.labelZh} · ${focus.labelEn}`)}</dd></div>
            <div><dt>Star</dt><dd data-disc-star>${escapeHtml(focus.star?.artist || "—")}</dd></div>
            <div><dt>Plays</dt><dd data-disc-plays>${escapeHtml(`${focus.plays} plays · ${formatDeltaShort(focus.delta)}`)}</dd></div>
          </dl>
          <p class="disc-meta-cta">Click focused disc to open</p>
        </div>
        <p class="disc-foot-note">${months.length} months · ${YEAR_LIST[0]}–${YEAR_LIST[YEAR_LIST.length - 1]}</p>
      </footer>
    </main>
  `;
}

async function bindReportDiscs() {
  if (typeof destroyDiscRail === "function") {
    destroyDiscRail();
    destroyDiscRail = null;
  }
  const root = app.querySelector(".report-discs");
  if (!root) return;

  const { months, startIndex } = reportDiscItems(
    Number(root.querySelector("[data-jump-year].is-active")?.dataset.jumpYear) || LATEST.year
  );
  const items = months.map((m) => {
    const top = m.tracks[0];
    return {
      id: m.id,
      href: `#/monthly-report/${m.year}/${pad(m.month)}`,
      title: top?.title || "",
      artist: top?.artist || "",
      year: m.year,
      month: m.month,
      monthLabel: `${m.labelZh} · ${m.labelEn}`,
      star: m.star?.artist || "—",
      plays: `${m.plays} plays · ${formatDeltaShort(m.delta)}`,
      quote: `${m.labelEn.toUpperCase()} · ${m.plays} PLAYS`,
      cover: coverUrl(top?.cover, 1000),
      hue: top?.hue || "#8fb38a",
    };
  });

  let tintTimer = 0;
  destroyDiscRail = bindDiscGallery(root, {
    items,
    startIndex,
    onOpen: (href) => {
      location.hash = href.startsWith("#") ? href : `#${href}`;
    },
    onActive: ({ id, hue, year }) => {
      if (hue) root.style.setProperty("--disc-tint", hue);
      root.__discGallery?.setRipplePalette?.(null, hue);
      root.querySelectorAll("[data-jump-year]").forEach((btn) => {
        btn.classList.toggle("is-active", Number(btn.dataset.jumpYear) === Number(year));
      });
      clearTimeout(tintTimer);
      tintTimer = setTimeout(async () => {
        const month = ALL_MONTHS.find((m) => m.id === id);
        if (!month || document.body.dataset.page !== "report-discs") return;
        const colors = await ensurePalette(month.id, month.tracks);
        if (document.body.dataset.page !== "report-discs") return;
        field.setPalette(colors);
        root.__discGallery?.setRipplePalette?.(colors, hue);
      }, 140);
    },
  });
}

function starArchiveSwitcher(activeYear) {
  const yearLinks = YEAR_LIST.map((y) => {
    const active = y === activeYear ? "is-active" : "";
    return `<a class="month-chip ${active}" href="#/monthly-report/star/${y}">${y}</a>`;
  }).join("");

  return `
    <nav class="month-switch archive-switch" aria-label="Monthly report star view">
      ${reportModeSwitcher("star", activeYear)}
      <span class="month-switch-label">YEAR</span>
      <div class="month-chips">${yearLinks}</div>
    </nav>
  `;
}

function starView(year) {
  const y = YEAR_MAP[year] ? year : LATEST.year;
  const months = monthsForYear(y);
  document.title = `MONTHLY STAR ${y} — CHARON STUDIO`;
  document.body.dataset.page = "star";
  field.setMode(1);
  const paletteSource = months[months.length - 1] || LATEST;
  field.setPalette(paletteFromHues(paletteSource.tracks));

  const cards = months
    .map((m) => {
      const cover = coverUrl(m.star?.cover || m.tracks[0]?.cover);
      const hits = starFavTracks(m);
      const hitNote = hits.length
        ? `FAV hit · ${hits.map((t) => t.title).join(" / ")}`
        : "No FAV intersection";
      return `
      <a class="star-card" href="#/monthly-report/${m.year}/${pad(m.month)}">
        <div class="star-card-cover">
          <img src="${cover}" alt="${escapeAttr(m.star?.artist || "")} cover" loading="lazy" />
        </div>
        <div class="star-card-meta">
          <p class="kicker">${m.labelZh} ‣ ${pad(m.month)}</p>
          <h2>${escapeHtml(m.star?.artist || "—")}</h2>
          <p class="track-meta">${formatArtTime(m.star?.artMinutes)} · ART</p>
          <p class="track-meta">${escapeHtml(hitNote)}</p>
        </div>
      </a>
    `;
    })
    .join("");

  return `
    ${header("star")}
    <main class="report star-page">
      ${starArchiveSwitcher(y)}
      <div class="archive-lead">
        <p class="kicker">Monthly Report ‣ Star ‣ ${y}</p>
        <p class="archive-lead-sub">${months.length} months · FAV ART + ART time</p>
      </div>
      <section class="month-grid star-grid">${cards}</section>
      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>Star archive ${y}</span>
      </footer>
    </main>
  `;
}

function archiveYearChips(basePath, activeYear, extraQuery = "") {
  const suffix = extraQuery ? `&${extraQuery.replace(/^&/, "")}` : "";
  const allActive = activeYear === "ALL" ? "is-active" : "";
  const years = [
    `<a class="month-chip ${allActive}" href="#${basePath}?year=ALL${suffix}">ALL</a>`,
    ...YEAR_LIST.map((y) => {
      const active = y === activeYear ? "is-active" : "";
      return `<a class="month-chip ${active}" href="#${basePath}?year=${y}${suffix}">${y}</a>`;
    }),
  ];
  return `
    <nav class="month-switch archive-switch" aria-label="Archive year filter">
      <span class="month-switch-label">YEAR</span>
      <div class="month-chips">${years.join("")}</div>
    </nav>
  `;
}

function archiveSubnav(active) {
  const items = [
    { id: "hub", href: "#/archive", label: "Index" },
    { id: "stars", href: "#/archive/stars", label: "Stars" },
    { id: "tracks", href: "#/archive/tracks", label: "Tracks" },
    { id: "albums", href: "#/archive/albums", label: "Albums" },
    { id: "artists", href: "#/archive/artists", label: "Artists" },
    { id: "ranks", href: "#/archive/ranks", label: "Ranks" },
    { id: "seasons", href: "#/archive/seasons", label: "Seasons" },
    { id: "plays", href: "#/archive/plays", label: "Plays" },
  ];
  return `
    <nav class="archive-subnav" aria-label="Archive sections">
      ${items
        .map(
          (it) =>
            `<a class="archive-subnav-link ${active === it.id ? "is-active" : ""}" href="${it.href}">${it.label}</a>`
        )
        .join("")}
    </nav>
  `;
}

function monthChipsHtml(months, limit = 8) {
  const shown = months.slice(0, limit);
  const rest = months.length - shown.length;
  const chips = shown
    .map(
      (m) =>
        `<a class="stats-month-chip" href="${m.href}">${m.labelEn.slice(0, 3)} ${String(m.year).slice(2)}</a>`
    )
    .join("");
  return `${chips}${rest > 0 ? `<span class="stats-month-more">+${rest}</span>` : ""}`;
}

function archiveHubView() {
  document.title = `ARCHIVE — CHARON STUDIO`;
  document.body.dataset.page = "archive";
  field.setMode(0.4);
  const wrap = yearWrap(ALL_MONTHS, LATEST.year);
  const starN = buildStarStats(ALL_MONTHS, "ALL").length;
  const trackN = buildTrackStats(ALL_MONTHS, "ALL").length;
  const albumN = buildAlbumStats(ALL_MONTHS, "ALL").length;
  const artistN = buildArtistBoard(ALL_MONTHS, "ALL").length;
  const rankN = buildRankDynamics(ALL_MONTHS, "ALL").length;
  const seasonPack = buildSeasonStats(ALL_MONTHS, "ALL");
  const plays = buildPlaysSeries(ALL_MONTHS, "ALL");

  return `
    ${header("archive")}
    <main class="archive-page">
      ${archiveSubnav("hub")}
      <header class="archive-hero">
        <p class="kicker">Archive ‣ Stats</p>
        <h1 class="index-title">Listening ledger</h1>
        <p class="index-sub">${ALL_MONTHS.length} months · ${YEAR_LIST[0]}–${YEAR_LIST[YEAR_LIST.length - 1]} · appearances ≠ plays</p>
      </header>

      <section class="archive-gate" aria-label="Archive sections">
        <a class="archive-gate-card" href="#/archive/stars">
          <p class="kicker">01 ‣ Star Hall</p>
          <h2>Monthly Star artists</h2>
          <p class="archive-gate-note">${starN} artists · count &amp; ART minutes</p>
        </a>
        <a class="archive-gate-card" href="#/archive/tracks">
          <p class="kicker">02 ‣ FAV Tracks</p>
          <h2>Songs on the board</h2>
          <p class="archive-gate-note">${trackN} titles · Top by appearances</p>
        </a>
        <a class="archive-gate-card" href="#/archive/albums">
          <p class="kicker">03 ‣ Album Hall</p>
          <h2>Albums on FAV</h2>
          <p class="archive-gate-note">${albumN} albums · appearances &amp; #1</p>
        </a>
        <a class="archive-gate-card" href="#/archive/artists">
          <p class="kicker">04 ‣ Artist Board</p>
          <h2>FAV + Star credit</h2>
          <p class="archive-gate-note">${artistN} artists · weighted board</p>
        </a>
        <a class="archive-gate-card" href="#/archive/ranks">
          <p class="kicker">05 ‣ Rank Dynamics</p>
          <h2>Streaks &amp; climbs</h2>
          <p class="archive-gate-note">${rankN} multi-month titles</p>
        </a>
        <a class="archive-gate-card" href="#/archive/seasons">
          <p class="kicker">06 ‣ Seasons</p>
          <h2>Season &amp; half-year</h2>
          <p class="archive-gate-note">${seasonPack.seasons.length} seasons · ${seasonPack.halves.length} halves</p>
        </a>
        <a class="archive-gate-card" href="#/archive/plays">
          <p class="kicker">07 ‣ Plays</p>
          <h2>Listening volume</h2>
          <p class="archive-gate-note">${plays.total.toLocaleString()} plays · peak ${escapeHtml(plays.peak?.label || "—")}</p>
        </a>
      </section>

      <section class="archive-wrap">
        <p class="kicker">Wrapped ‣ ${wrap.year}</p>
        <dl class="archive-wrap-list">
          <div>
            <dt>Star king</dt>
            <dd>${wrap.starKing ? escapeHtml(`${wrap.starKing.artist} · ${wrap.starKing.count}×`) : "—"}</dd>
          </div>
          <div>
            <dt>Track king</dt>
            <dd>${
              wrap.trackKing
                ? escapeHtml(`${wrap.trackKing.title} · ${wrap.trackKing.appearances} mo`)
                : "—"
            }</dd>
          </div>
          <div>
            <dt>Peak month</dt>
            <dd>${
              wrap.peakMonth
                ? `<a href="${wrap.peakMonth.href}">${escapeHtml(wrap.peakMonth.label)} · ${wrap.peakMonth.plays.toLocaleString()}</a>`
                : "—"
            }</dd>
          </div>
          <div>
            <dt>Year plays</dt>
            <dd>${wrap.totalPlays.toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>Archive from existing monthly reports</span>
      </footer>
    </main>
  `;
}

function archiveStarsView(year = "ALL", sort = "count") {
  document.title = `STAR HALL — ARCHIVE — CHARON STUDIO`;
  document.body.dataset.page = "archive-stars";
  field.setMode(0.45);
  const mode = sort === "minutes" ? "minutes" : "count";
  const rows = sortStarStats(buildStarStats(ALL_MONTHS, year), mode);

  const list = rows
    .map((r, i) => {
      const cover = coverUrl(r.cover, 400);
      return `
      <article class="stats-row stats-row-star">
        <p class="stats-rank">${pad(i + 1)}</p>
        <div class="stats-cover">
          ${cover ? `<img src="${cover}" alt="${escapeAttr(r.artist)}" loading="lazy" />` : ""}
        </div>
        <div class="stats-body">
          <h2 class="stats-title">${escapeHtml(r.artist)}</h2>
          <p class="stats-line">
            <strong>${r.count}</strong> month${r.count === 1 ? "" : "s"}
            · ${formatArtTime(r.artMinutesTotal)} total
            · avg ${formatArtTime(Math.round(r.artMinutesAvg))}
            · peak ${formatArtTime(r.artMinutesPeak)}
          </p>
          <p class="stats-line muted">
            Last <a href="${r.lastHref}">${escapeHtml(r.lastId)}</a>
            · FAV overlap ${r.favIntersectionMonths}/${r.count}
          </p>
          <div class="stats-month-rail">${monthChipsHtml(r.months)}</div>
        </div>
      </article>`;
    })
    .join("");

  return `
    ${header("archive")}
    <main class="archive-page">
      ${archiveSubnav("stars")}
      ${archiveYearChips("/archive/stars", year, `sort=${mode}`)}
      <header class="archive-hero archive-hero-compact">
        <p class="kicker">Archive ‣ Star Hall</p>
        <h1 class="index-title">Star artists</h1>
        <p class="index-sub">${rows.length} artists · monthly star only</p>
        <div class="stats-mode" role="group" aria-label="Sort Star Hall">
          <a class="month-chip ${mode === "count" ? "is-active" : ""}" href="#/archive/stars?year=${year}&sort=count">By count</a>
          <a class="month-chip ${mode === "minutes" ? "is-active" : ""}" href="#/archive/stars?year=${year}&sort=minutes">By ART minutes</a>
        </div>
      </header>
      <section class="stats-list">${list || `<p class="archive-empty">No stars in this filter.</p>`}</section>
      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>Star Hall</span>
      </footer>
    </main>
  `;
}

function archiveTracksView(year = "ALL", sort = "appearances", limit = 10) {
  document.title = `FAV TRACKS — ARCHIVE — CHARON STUDIO`;
  document.body.dataset.page = "archive-tracks";
  field.setMode(0.45);
  const mode =
    sort === "numberOnes" || sort === "ones"
      ? "numberOnes"
      : sort === "weighted"
        ? "weighted"
        : "appearances";
  const cap = limit === 20 ? 20 : 10;
  const all = sortTrackStats(buildTrackStats(ALL_MONTHS, year), mode);
  const rows = all.slice(0, cap);

  const list = rows
    .map((r, i) => {
      const cover = coverUrl(r.cover, 400);
      return `
      <article class="stats-row stats-row-track">
        <p class="stats-rank">${pad(i + 1)}</p>
        <div class="stats-cover">
          ${cover ? `<img src="${cover}" alt="${escapeAttr(r.title)}" loading="lazy" />` : ""}
        </div>
        <div class="stats-body">
          <h2 class="stats-title">${escapeHtml(r.title)}</h2>
          <p class="stats-line">${escapeHtml(r.artist)}</p>
          <p class="stats-line">
            <strong>${r.appearances}</strong> appearance${r.appearances === 1 ? "" : "s"}
            · <strong>${r.numberOnes}</strong> × #1
            · weighted ${r.weighted}
            ${r.isComeback ? " · comeback" : ""}
          </p>
          <p class="stats-note muted">Appearances count months on FAV.01–04 — not stream plays.</p>
          <div class="stats-month-rail">${monthChipsHtml(r.months)}</div>
        </div>
      </article>`;
    })
    .join("");

  const yq = `year=${year}`;
  return `
    ${header("archive")}
    <main class="archive-page">
      ${archiveSubnav("tracks")}
      ${archiveYearChips("/archive/tracks", year, `sort=${mode}&limit=${cap}`)}
      <header class="archive-hero archive-hero-compact">
        <p class="kicker">Archive ‣ FAV Tracks</p>
        <h1 class="index-title">Songs on the board</h1>
        <p class="index-sub">Top ${cap} of ${all.length} · appearances ≠ plays</p>
        <div class="stats-mode" role="group" aria-label="Sort FAV tracks">
          <a class="month-chip ${mode === "appearances" ? "is-active" : ""}" href="#/archive/tracks?${yq}&sort=appearances&limit=${cap}">Appearances</a>
          <a class="month-chip ${mode === "numberOnes" ? "is-active" : ""}" href="#/archive/tracks?${yq}&sort=numberOnes&limit=${cap}">#1 months</a>
          <a class="month-chip ${mode === "weighted" ? "is-active" : ""}" href="#/archive/tracks?${yq}&sort=weighted&limit=${cap}">Weighted</a>
        </div>
        <div class="stats-mode" role="group" aria-label="List length">
          <a class="month-chip ${cap === 10 ? "is-active" : ""}" href="#/archive/tracks?${yq}&sort=${mode}&limit=10">Top 10</a>
          <a class="month-chip ${cap === 20 ? "is-active" : ""}" href="#/archive/tracks?${yq}&sort=${mode}&limit=20">Top 20</a>
        </div>
      </header>
      <section class="stats-list">${list || `<p class="archive-empty">No tracks in this filter.</p>`}</section>
      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>FAV track board</span>
      </footer>
    </main>
  `;
}

function archiveAlbumsView(year = "ALL", sort = "appearances", limit = 20) {
  document.title = `ALBUM HALL — ARCHIVE — CHARON STUDIO`;
  document.body.dataset.page = "archive-albums";
  field.setMode(0.45);
  const mode =
    sort === "numberOnes" || sort === "ones"
      ? "numberOnes"
      : sort === "weighted"
        ? "weighted"
        : "appearances";
  const cap = limit === 10 ? 10 : 20;
  const all = sortAlbumStats(buildAlbumStats(ALL_MONTHS, year), mode);
  const rows = all.slice(0, cap);
  const yq = `year=${year}`;

  const list = rows
    .map((r, i) => {
      const cover = coverUrl(r.cover, 400);
      return `
      <article class="stats-row stats-row-album">
        <p class="stats-rank">${pad(i + 1)}</p>
        <div class="stats-cover">
          ${cover ? `<img src="${cover}" alt="${escapeAttr(r.album)}" loading="lazy" />` : ""}
        </div>
        <div class="stats-body">
          <h2 class="stats-title">${escapeHtml(r.album)}</h2>
          <p class="stats-line">${escapeHtml(r.artists.join(" · ") || "—")}</p>
          <p class="stats-line">
            <strong>${r.appearances}</strong> FAV hits
            · <strong>${r.numberOnes}</strong> × #1
            · ${r.uniqueMonths} months
            · ${r.trackCount} track${r.trackCount === 1 ? "" : "s"}
            · weighted ${r.weighted}
          </p>
          <div class="stats-month-rail">${monthChipsHtml(r.months)}</div>
        </div>
      </article>`;
    })
    .join("");

  return `
    ${header("archive")}
    <main class="archive-page">
      ${archiveSubnav("albums")}
      ${archiveYearChips("/archive/albums", year, `sort=${mode}&limit=${cap}`)}
      <header class="archive-hero archive-hero-compact">
        <p class="kicker">Archive ‣ Album Hall</p>
        <h1 class="index-title">Albums on FAV</h1>
        <p class="index-sub">Top ${cap} of ${all.length} · from track album fields</p>
        <div class="stats-mode" role="group" aria-label="Sort albums">
          <a class="month-chip ${mode === "appearances" ? "is-active" : ""}" href="#/archive/albums?${yq}&sort=appearances&limit=${cap}">Appearances</a>
          <a class="month-chip ${mode === "numberOnes" ? "is-active" : ""}" href="#/archive/albums?${yq}&sort=numberOnes&limit=${cap}">#1 months</a>
          <a class="month-chip ${mode === "weighted" ? "is-active" : ""}" href="#/archive/albums?${yq}&sort=weighted&limit=${cap}">Weighted</a>
        </div>
        <div class="stats-mode" role="group" aria-label="List length">
          <a class="month-chip ${cap === 10 ? "is-active" : ""}" href="#/archive/albums?${yq}&sort=${mode}&limit=10">Top 10</a>
          <a class="month-chip ${cap === 20 ? "is-active" : ""}" href="#/archive/albums?${yq}&sort=${mode}&limit=20">Top 20</a>
        </div>
      </header>
      <section class="stats-list">${list || `<p class="archive-empty">No albums in this filter.</p>`}</section>
      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>Album Hall</span>
      </footer>
    </main>
  `;
}

function archiveArtistsView(year = "ALL", sort = "weighted", limit = 20) {
  document.title = `ARTIST BOARD — ARCHIVE — CHARON STUDIO`;
  document.body.dataset.page = "archive-artists";
  field.setMode(0.45);
  const mode =
    sort === "fav"
      ? "fav"
      : sort === "star"
        ? "star"
        : sort === "ones" || sort === "numberOnes"
          ? "ones"
          : "weighted";
  const cap = limit === 10 ? 10 : 20;
  const all = sortArtistBoard(buildArtistBoard(ALL_MONTHS, year), mode);
  const rows = all.slice(0, cap);
  const yq = `year=${year}`;

  const list = rows
    .map((r, i) => {
      const cover = coverUrl(r.cover, 400);
      return `
      <article class="stats-row stats-row-artist">
        <p class="stats-rank">${pad(i + 1)}</p>
        <div class="stats-cover">
          ${cover ? `<img src="${cover}" alt="${escapeAttr(r.artist)}" loading="lazy" />` : ""}
        </div>
        <div class="stats-body">
          <h2 class="stats-title">${escapeHtml(r.artist)}</h2>
          <p class="stats-line">
            <strong>${r.favAppearances}</strong> FAV credits
            · <strong>${r.numberOnes}</strong> × #1
            · weighted ${r.weighted}
            · Star ${r.starCount}×
            ${r.starCount ? `· ${formatArtTime(r.artMinutesTotal)} ART` : ""}
            ${r.isStarOnly ? " · star only" : ""}
          </p>
          <p class="stats-line muted">${r.uniqueMonths} unique months · collabs split on / &amp; feat.</p>
          <div class="stats-month-rail">${monthChipsHtml(r.months)}</div>
        </div>
      </article>`;
    })
    .join("");

  return `
    ${header("archive")}
    <main class="archive-page">
      ${archiveSubnav("artists")}
      ${archiveYearChips("/archive/artists", year, `sort=${mode}&limit=${cap}`)}
      <header class="archive-hero archive-hero-compact">
        <p class="kicker">Archive ‣ Artist Board</p>
        <h1 class="index-title">FAV + Star credit</h1>
        <p class="index-sub">Top ${cap} of ${all.length} · broader than Star Hall</p>
        <div class="stats-mode" role="group" aria-label="Sort artists">
          <a class="month-chip ${mode === "weighted" ? "is-active" : ""}" href="#/archive/artists?${yq}&sort=weighted&limit=${cap}">Weighted</a>
          <a class="month-chip ${mode === "fav" ? "is-active" : ""}" href="#/archive/artists?${yq}&sort=fav&limit=${cap}">FAV hits</a>
          <a class="month-chip ${mode === "ones" ? "is-active" : ""}" href="#/archive/artists?${yq}&sort=ones&limit=${cap}">#1</a>
          <a class="month-chip ${mode === "star" ? "is-active" : ""}" href="#/archive/artists?${yq}&sort=star&limit=${cap}">Star months</a>
        </div>
        <div class="stats-mode" role="group" aria-label="List length">
          <a class="month-chip ${cap === 10 ? "is-active" : ""}" href="#/archive/artists?${yq}&sort=${mode}&limit=10">Top 10</a>
          <a class="month-chip ${cap === 20 ? "is-active" : ""}" href="#/archive/artists?${yq}&sort=${mode}&limit=20">Top 20</a>
        </div>
      </header>
      <section class="stats-list">${list || `<p class="archive-empty">No artists in this filter.</p>`}</section>
      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>Artist Board</span>
      </footer>
    </main>
  `;
}

function archiveRanksView(year = "ALL", sort = "board", limit = 20) {
  document.title = `RANK DYNAMICS — ARCHIVE — CHARON STUDIO`;
  document.body.dataset.page = "archive-ranks";
  field.setMode(0.45);
  const mode =
    sort === "ones"
      ? "ones"
      : sort === "climb"
        ? "climb"
        : sort === "gap"
          ? "gap"
          : "board";
  const cap = limit === 10 ? 10 : 20;
  const all = sortRankDynamics(buildRankDynamics(ALL_MONTHS, year), mode);
  const rows = all.slice(0, cap);
  const yq = `year=${year}`;

  const list = rows
    .map((r, i) => {
      const cover = coverUrl(r.cover, 400);
      const rankTrail = (r.ranks || [])
        .slice(0, 8)
        .map((n) => `#${n}`)
        .join(" → ");
      return `
      <article class="stats-row stats-row-rank">
        <p class="stats-rank">${pad(i + 1)}</p>
        <div class="stats-cover">
          ${cover ? `<img src="${cover}" alt="${escapeAttr(r.title)}" loading="lazy" />` : ""}
        </div>
        <div class="stats-body">
          <h2 class="stats-title">${escapeHtml(r.title)}</h2>
          <p class="stats-line">${escapeHtml(r.artist)}</p>
          <p class="stats-line">
            board streak <strong>${r.boardStreak}</strong>
            · #1 streak <strong>${r.oneStreak}</strong>
            · best climb <strong>${r.bestClimb}</strong>
            · max gap <strong>${r.maxGap}</strong> mo
          </p>
          <p class="stats-line muted">${r.appearances} appearances · ${escapeHtml(rankTrail)}${(r.ranks || []).length > 8 ? " …" : ""}</p>
          <div class="stats-month-rail">${monthChipsHtml(r.months)}</div>
        </div>
      </article>`;
    })
    .join("");

  return `
    ${header("archive")}
    <main class="archive-page">
      ${archiveSubnav("ranks")}
      ${archiveYearChips("/archive/ranks", year, `sort=${mode}&limit=${cap}`)}
      <header class="archive-hero archive-hero-compact">
        <p class="kicker">Archive ‣ Rank Dynamics</p>
        <h1 class="index-title">Streaks &amp; climbs</h1>
        <p class="index-sub">Top ${cap} of ${all.length} · titles with 2+ FAV months</p>
        <div class="stats-mode" role="group" aria-label="Sort rank dynamics">
          <a class="month-chip ${mode === "board" ? "is-active" : ""}" href="#/archive/ranks?${yq}&sort=board&limit=${cap}">Board streak</a>
          <a class="month-chip ${mode === "ones" ? "is-active" : ""}" href="#/archive/ranks?${yq}&sort=ones&limit=${cap}">#1 streak</a>
          <a class="month-chip ${mode === "climb" ? "is-active" : ""}" href="#/archive/ranks?${yq}&sort=climb&limit=${cap}">Best climb</a>
          <a class="month-chip ${mode === "gap" ? "is-active" : ""}" href="#/archive/ranks?${yq}&sort=gap&limit=${cap}">Comeback gap</a>
        </div>
        <div class="stats-mode" role="group" aria-label="List length">
          <a class="month-chip ${cap === 10 ? "is-active" : ""}" href="#/archive/ranks?${yq}&sort=${mode}&limit=10">Top 10</a>
          <a class="month-chip ${cap === 20 ? "is-active" : ""}" href="#/archive/ranks?${yq}&sort=${mode}&limit=20">Top 20</a>
        </div>
      </header>
      <section class="stats-list">${list || `<p class="archive-empty">No multi-month titles in this filter.</p>`}</section>
      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>Rank Dynamics</span>
      </footer>
    </main>
  `;
}

function archiveSeasonsView(year = "ALL") {
  document.title = `SEASONS — ARCHIVE — CHARON STUDIO`;
  document.body.dataset.page = "archive-seasons";
  field.setMode(0.4);
  const pack = buildSeasonStats(ALL_MONTHS, year);

  const seasonCards = pack.seasons
    .map((s) => {
      const cover = coverUrl(s.cover, 600);
      return `
      <article class="season-card">
        <div class="season-card-cover">
          ${cover ? `<img src="${cover}" alt="" loading="lazy" />` : ""}
        </div>
        <div class="season-card-body">
          <p class="kicker">${escapeHtml(s.labelZh)} ‣ ${escapeHtml(s.labelEn)}</p>
          <h2 class="stats-title">${escapeHtml(s.monthsLabel)}</h2>
          <p class="stats-line">
            <strong>${s.monthCount}</strong> months
            · ${s.totalPlays.toLocaleString()} plays
            · avg ${s.avgPlays.toLocaleString()}
          </p>
          <p class="stats-line">
            Star lead · ${s.topStar ? escapeHtml(`${s.topStar.artist} · ${s.topStar.count}×`) : "—"}
          </p>
          <p class="stats-line">
            FAV.01 lead · ${
              s.topTrack
                ? escapeHtml(`${s.topTrack.title} · ${s.topTrack.count}×`)
                : "—"
            }
          </p>
          <div class="stats-month-rail">${monthChipsHtml(s.months, 8)}</div>
        </div>
      </article>`;
    })
    .join("");

  const halfCards = pack.halves
    .map((h) => {
      return `
      <article class="season-half">
        <p class="kicker">${escapeHtml(h.labelZh)} ‣ ${escapeHtml(h.labelEn)}</p>
        <h3>${escapeHtml(h.monthsLabel)}</h3>
        <p class="stats-line">
          <strong>${h.monthCount}</strong> months · ${h.totalPlays.toLocaleString()} plays · avg ${h.avgPlays.toLocaleString()}
        </p>
        <p class="stats-line muted">
          Star · ${h.topStar ? escapeHtml(`${h.topStar.artist} · ${h.topStar.count}×`) : "—"}
          · FAV.01 · ${h.topTrack ? escapeHtml(`${h.topTrack.title} · ${h.topTrack.count}×`) : "—"}
        </p>
      </article>`;
    })
    .join("");

  return `
    ${header("archive")}
    <main class="archive-page">
      ${archiveSubnav("seasons")}
      ${archiveYearChips("/archive/seasons", year)}
      <header class="archive-hero archive-hero-compact">
        <p class="kicker">Archive ‣ Seasons</p>
        <h1 class="index-title">Season &amp; half-year</h1>
        <p class="index-sub">${year === "ALL" ? "All years" : year} · plays + Star + FAV.01</p>
      </header>
      <section class="season-grid" aria-label="Four seasons">
        ${seasonCards || `<p class="archive-empty">No season data.</p>`}
      </section>
      <section class="season-half-grid" aria-label="Half years">
        ${halfCards}
      </section>
      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>Season rolls</span>
      </footer>
    </main>
  `;
}

function archivePlaysView(year = "ALL") {
  document.title = `PLAYS — ARCHIVE — CHARON STUDIO`;
  document.body.dataset.page = "archive-plays";
  field.setMode(0.4);
  const series = buildPlaysSeries(ALL_MONTHS, year);
  const max = series.maxPlays || 1;

  const bars = series.points
    .map((p) => {
      const h = Math.max(4, Math.round((p.plays / max) * 100));
      const isPeak = series.peak && p.id === series.peak.id;
      const isTrough = series.trough && p.id === series.trough.id;
      const mark = isPeak ? "is-peak" : isTrough ? "is-trough" : "";
      return `
      <a class="plays-bar ${mark}" href="${p.href}" style="--h:${h}%" title="${escapeAttr(`${p.labelEn} ${p.year}: ${p.plays} plays`)}">
        <span class="plays-bar-fill"></span>
        <span class="plays-bar-label">${p.labelEn.slice(0, 1)}${String(p.year).slice(2)}</span>
        <span class="plays-bar-val">${p.plays}</span>
      </a>`;
    })
    .join("");

  return `
    ${header("archive")}
    <main class="archive-page">
      ${archiveSubnav("plays")}
      ${archiveYearChips("/archive/plays", year)}
      <header class="archive-hero archive-hero-compact">
        <p class="kicker">Archive ‣ Plays</p>
        <h1 class="index-title">Listening volume</h1>
        <p class="index-sub">
          ${series.points.length} months · total ${series.total.toLocaleString()}
          · peak <a href="${series.peak?.href || "#"}">${escapeHtml(series.peak?.label || "—")}</a>
          · low <a href="${series.trough?.href || "#"}">${escapeHtml(series.trough?.label || "—")}</a>
        </p>
      </header>
      <section class="plays-strip" aria-label="Monthly plays timeline">
        ${bars || `<p class="archive-empty">No plays in this filter.</p>`}
      </section>
      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>Plays timeline</span>
      </footer>
    </main>
  `;
}

function monthView(month) {
  document.title = `${month.labelEn.toUpperCase()} ${month.year} — CHARON STUDIO`;
  document.body.dataset.page = "report";
  field.setMode(1);
  field.setPalette(paletteCache.get(month.id) || paletteFromHues(month.tracks));

  const top = month.tracks[0];
  const favCount = month.tracks.length;
  const favRange = favCount <= 1 ? "FAV.01" : `FAV.01–${pad(favCount)}`;
  const credit = creditLine(month);
  const tracks = month.tracks
    .map(
      (t) => `
      <article class="track">
        <button class="track-head" type="button" aria-expanded="false" aria-label="FAV.${pad(t.rank)} ${escapeAttr(t.title)} by ${escapeAttr(t.artist)}">
          <span class="rank">${pad(t.rank)}</span>
          <span class="track-artist">${escapeHtml(t.artist)}</span>
          <span class="track-hint" aria-hidden="true">↓</span>
        </button>
        <div class="track-drawer">
          <div class="track-drawer-inner">
            <div class="track-cover">
              <img src="${coverUrl(t.cover)}" alt="${escapeAttr(t.title)} cover" loading="lazy" />
            </div>
            <div class="track-detail">
              <p class="track-kicker">${pad(t.rank)} ‣ FAV.${pad(t.rank)}</p>
              <h3>${escapeHtml(t.title)}</h3>
              <p class="track-meta">${escapeHtml(t.artist)}</p>
              <p class="track-meta">${escapeHtml(t.album || "—")}</p>
            </div>
          </div>
        </div>
      </article>
    `
    )
    .join("");

  return `
    ${header("report")}
    <main class="report">
      ${archiveSwitcher(month.year, month.id)}
      <section class="report-hero">
        <figure class="hero-cover">
          <p class="kicker">Monthly Report ‣ ${month.labelZh} ${month.year}</p>
          <div class="hero-stage">
            <div class="hero-cover-frame">
              <img src="${coverUrl(top.cover, 800)}" alt="${escapeAttr(top.title)} cover" />
              <span class="hero-artist">${escapeHtml(top.artist)}</span>
            </div>
            <div class="top-mark" aria-label="FAV 01">
              <span class="top-mark-num">1</span>
              <span class="top-mark-label">FAV</span>
            </div>
          </div>
          <figcaption>
            <span>01 ‣ ${escapeHtml(top.title)}</span>
            <span>FAV.01</span>
          </figcaption>
        </figure>
        <dl class="meta-board">
          <div class="stat">
            <dt>听歌量 Plays</dt>
            <dd>${month.plays}<small>${formatDelta(month.delta)}</small></dd>
          </div>
          <div class="stat">
            <dt>Monthly Star</dt>
            <dd>★ ${escapeHtml(month.star.artist)}<small>本月最佳歌手</small></dd>
          </div>
          <div class="stat">
            <dt>ART 时长</dt>
            <dd>${formatArtTime(month.star.artMinutes)}<small>${month.star.artMinutes} min</small></dd>
          </div>
          <div class="stat">
            <dt>FAV Tracks</dt>
            <dd>${pad(favCount)}<small>${escapeHtml(credit)}</small></dd>
          </div>
        </dl>
      </section>
      <section class="tracks">
        <div class="tracks-head">
          <p class="kicker">本月最爱</p>
          <p class="kicker">${escapeHtml(credit)}</p>
        </div>
        <div class="track-block">
          <p class="kicker track-block-label">本月最佳歌手 ‣ Monthly Star</p>
          <div class="track-list">
            ${starMonthBlock(month, top)}
          </div>
        </div>
        <div class="track-block">
          <p class="kicker track-block-label">本月歌单 ‣ ${favRange}</p>
          <div class="track-list">${tracks}</div>
        </div>
      </section>
      <footer class="site-footer">
        <span>${escapeHtml(credit)}</span>
        <span>${month.labelEn} ${month.year}</span>
      </footer>
    </main>
  `;
}

function bindDrawers(selector = ".track") {
  const items = [...document.querySelectorAll(selector)].filter(
    (item) => !item.classList.contains("star-in-month")
  );
  if (!items.length) return;

  const closeAll = (except) => {
    items.forEach((item) => {
      if (item === except) return;
      item.classList.remove("is-open");
      const btn = item.querySelector(".track-head");
      if (btn) btn.setAttribute("aria-expanded", "false");
    });
  };

  items.forEach((item) => {
    const head = item.querySelector(".track-head");
    if (!head) return;
    let leaveTimer = 0;
    const open = () => {
      clearTimeout(leaveTimer);
      closeAll(item);
      item.classList.add("is-open");
      head.setAttribute("aria-expanded", "true");
    };
    const close = () => {
      item.classList.remove("is-open");
      head.setAttribute("aria-expanded", "false");
    };
    item.addEventListener("mouseenter", open);
    item.addEventListener("mouseleave", () => {
      leaveTimer = window.setTimeout(close, 120);
    });
    head.addEventListener("focus", open);
    head.addEventListener("blur", () => {
      leaveTimer = window.setTimeout(() => {
        if (!item.contains(document.activeElement)) close();
      }, 120);
    });
    head.addEventListener("click", () => {
      if (item.classList.contains("is-open")) close();
      else open();
    });
  });
}

async function ensurePalette(key, tracks) {
  if (paletteCache.has(key)) return paletteCache.get(key);
  const colors = await paletteFromTracks(tracks);
  paletteCache.set(key, colors);
  return colors;
}

async function ensureHomePalette() {
  if (paletteCache.has("home")) return paletteCache.get("home");
  const colors = await paletteFromHomeTrack(CURRENT_FAV);
  paletteCache.set("home", colors);
  return colors;
}

async function render() {
  const route = parseRoute();

  if (typeof destroyDiscRail === "function") {
    destroyDiscRail();
    destroyDiscRail = null;
  }

  if (route.name === "month") {
    const month = findMonth(route.year, route.month);
    if (!month) {
      location.hash = `#/monthly-report/${route.year || LATEST.year}`;
      return;
    }
    app.innerHTML = monthView(month);
    bindDrawers();
    const colors = await ensurePalette(month.id, month.tracks);
    if (parseRoute().name === "month") field.setPalette(colors);
  } else if (route.name === "report-index") {
    const year = route.year || LATEST.year;
    app.innerHTML = reportIndexView(year);
    await bindReportDiscs();
    const sample = ALL_MONTHS[ALL_MONTHS.length - 1] || LATEST;
    const colors = await ensurePalette(sample.id, sample.tracks);
    if (parseRoute().name === "report-index") field.setPalette(colors);
  } else if (route.name === "star") {
    const year = route.year || LATEST.year;
    app.innerHTML = starView(year);
    const months = monthsForYear(year);
    const sample = months[months.length - 1] || LATEST;
    const colors = await ensurePalette(`star-${year}`, sample.tracks);
    if (parseRoute().name === "star") field.setPalette(colors);
  } else if (route.name === "archive") {
    app.innerHTML = archiveHubView();
    const colors = await ensureHomePalette();
    if (parseRoute().name === "archive") field.setPalette(colors);
  } else if (route.name === "archive-stars") {
    app.innerHTML = archiveStarsView(route.year || "ALL", route.sort || "count");
    const sample = ALL_MONTHS[ALL_MONTHS.length - 1] || LATEST;
    const colors = await ensurePalette("archive-stars", sample.tracks);
    if (parseRoute().name === "archive-stars") field.setPalette(colors);
  } else if (route.name === "archive-tracks") {
    app.innerHTML = archiveTracksView(
      route.year || "ALL",
      route.sort || "appearances",
      route.limit || 10
    );
    const sample = ALL_MONTHS[ALL_MONTHS.length - 1] || LATEST;
    const colors = await ensurePalette("archive-tracks", sample.tracks);
    if (parseRoute().name === "archive-tracks") field.setPalette(colors);
  } else if (route.name === "archive-albums") {
    app.innerHTML = archiveAlbumsView(
      route.year || "ALL",
      route.sort || "appearances",
      route.limit || 20
    );
    const sample = ALL_MONTHS[ALL_MONTHS.length - 1] || LATEST;
    const colors = await ensurePalette("archive-albums", sample.tracks);
    if (parseRoute().name === "archive-albums") field.setPalette(colors);
  } else if (route.name === "archive-artists") {
    app.innerHTML = archiveArtistsView(
      route.year || "ALL",
      route.sort || "weighted",
      route.limit || 20
    );
    const sample = ALL_MONTHS[ALL_MONTHS.length - 1] || LATEST;
    const colors = await ensurePalette("archive-artists", sample.tracks);
    if (parseRoute().name === "archive-artists") field.setPalette(colors);
  } else if (route.name === "archive-ranks") {
    app.innerHTML = archiveRanksView(
      route.year || "ALL",
      route.sort || "board",
      route.limit || 20
    );
    const sample = ALL_MONTHS[ALL_MONTHS.length - 1] || LATEST;
    const colors = await ensurePalette("archive-ranks", sample.tracks);
    if (parseRoute().name === "archive-ranks") field.setPalette(colors);
  } else if (route.name === "archive-seasons") {
    app.innerHTML = archiveSeasonsView(route.year || "ALL");
    const sample = ALL_MONTHS[ALL_MONTHS.length - 1] || LATEST;
    const colors = await ensurePalette("archive-seasons", sample.tracks);
    if (parseRoute().name === "archive-seasons") field.setPalette(colors);
  } else if (route.name === "archive-plays") {
    app.innerHTML = archivePlaysView(route.year || "ALL");
    const sample = ALL_MONTHS[ALL_MONTHS.length - 1] || LATEST;
    const colors = await ensurePalette("archive-plays", sample.tracks);
    if (parseRoute().name === "archive-plays") field.setPalette(colors);
  } else if (route.name === "news-index") {
    app.innerHTML = newsIndexView();
    const colors = await ensureHomePalette();
    if (parseRoute().name === "news-index") field.setPalette(colors);
  } else if (route.name === "news-detail") {
    const item = findNews(route.id);
    if (!item || !monthlyNewsIds.includes(item.id)) {
      location.hash = "#/monthly-news";
      return;
    }
    app.innerHTML = newsDetailView(item);
    const colors = await ensureHomePalette();
    if (parseRoute().name === "news-detail") field.setPalette(colors);
  } else if (route.name === "review-index") {
    app.innerHTML = reviewIndexView();
    bindReviewScroll();
    const target = LATEST_REVIEW || ALBUM_REVIEWS[0];
    const colors = target
      ? await ensureReviewPalette(target)
      : await ensureHomePalette();
    if (parseRoute().name === "review-index" || parseRoute().name === "review-detail") {
      field.setPalette(colors);
      applyReviewTheme(colors);
    }
  } else if (route.name === "review-detail") {
    const item = findReview(route.id);
    if (!item || !reviewIds.includes(item.id)) {
      location.hash = "#/album-review";
      return;
    }
    app.innerHTML = reviewDetailView(item);
    bindReviewScroll();
    const colors = await ensureReviewPalette(item);
    if (parseRoute().name === "review-detail") {
      field.setPalette(colors);
      applyReviewTheme(colors);
    }
  } else if (route.name === "award") {
    app.innerHTML = awardView();
    const colors = await ensureHomePalette();
    if (parseRoute().name === "award") field.setPalette(colors);
  } else {
    app.innerHTML = homeView();
    requestAnimationFrame(fitMast);
    const colors = await ensureHomePalette();
    if (parseRoute().name === "home") field.setPalette(colors);
  }
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", () => {
  render();
});
window.addEventListener("resize", () => {
  if (document.body.dataset.page === "home") fitMast();
});
render();
