import { startField } from "./field.js?v=62";
import {
  HOME_PALETTE,
  paletteFromCoverDeep,
  paletteFromHomeTrack,
  paletteFromHues,
  paletteFromTracks,
} from "./palette.js?v=107";
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
} from "./data/stats.js?v=102";
import { monthlyNewsIds, newsItems } from "./data/news.js?v=102";
import { reviewIds, reviewItems } from "./data/reviews.js?v=106";
import {
  AWARD_EDITION,
  SINGLE_AWARDS,
  SPECIAL_AWARDS,
} from "./data/awards.js?v=110";
import { AWARD_EXTRA_COVERS } from "./data/award-covers.js?v=110";
import { getAwardNominees } from "./data/award-nominees.js?v=122";
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
  if (p === "/" || p === "") return { name: "award-home" };
  if (p === "/studio" || p === "/studio/" || p === "/home" || p === "/home/") {
    return { name: "home" };
  }
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

  const awardNom = p.match(/^\/award\/([^/]+)\/?$/);
  if (awardNom) {
    return { name: "award-nominee", id: decodeURIComponent(awardNom[1]) };
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
  return { name: "award-home" };
}

function header(page) {
  const archiveOn = page === "archive" || String(page).startsWith("archive");
  const reportOn = page === "report" || page === "star";
  const awardOn = page === "award" || page === "award-home";
  return `
    <header class="site-header">
      <a class="wordmark" href="#/studio" aria-label="CHARON STUDIO 原主页">CHARON <i></i> <span>studio</span></a>
      <nav class="nav-cols" aria-label="Primary">
        <ul class="nav-list">
          <li><a href="#/" class="${awardOn ? "is-active" : ""}">Sonic Luminous Award</a></li>
          <li><a href="#/monthly-news" class="${page === "news" ? "is-active" : ""}">Monthly News</a></li>
          <li><a href="#/album-review" class="${page === "review" ? "is-active" : ""}">New Album Review</a></li>
          <li><a href="#/monthly-report" class="${reportOn ? "is-active" : ""}">Monthly Report</a></li>
          <li><a href="#/archive" class="${archiveOn ? "is-active" : ""}">Archive 档案</a></li>
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
    item.typeface === "plain" ? "is-plain" : "",
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

const REVIEW_DRAFT_PREFIX = "charon-review-draft:";

function reviewDraftKey(id) {
  return `${REVIEW_DRAFT_PREFIX}${id}`;
}

function loadReviewDraft(id, fallback = "") {
  try {
    const raw = localStorage.getItem(reviewDraftKey(id));
    if (raw == null) return String(fallback || "");
    return String(raw);
  } catch {
    return String(fallback || "");
  }
}

function saveReviewDraft(id, text) {
  try {
    localStorage.setItem(reviewDraftKey(id), String(text ?? ""));
    return true;
  } catch {
    return false;
  }
}

function bindReviewEditor() {
  const form = document.querySelector("[data-review-editor]");
  if (!form) return;
  const id = form.getAttribute("data-review-id");
  const ta = form.querySelector("textarea");
  const count = form.querySelector("[data-review-count]");
  const status = form.querySelector("[data-review-status]");
  const limit = Number(form.getAttribute("data-review-limit") || 1000);
  if (!id || !ta) return;

  let timer = 0;
  const paint = (state) => {
    if (count) count.textContent = `${ta.value.length}/${limit}`;
    if (!status) return;
    status.textContent =
      state === "saving" ? "保存中…" : state === "error" ? "保存失败" : "已保存";
    status.dataset.state = state || "saved";
  };

  const persist = () => {
    const ok = saveReviewDraft(id, ta.value.slice(0, limit));
    paint(ok ? "saved" : "error");
  };

  ta.addEventListener("input", () => {
    if (ta.value.length > limit) ta.value = ta.value.slice(0, limit);
    paint("saving");
    window.clearTimeout(timer);
    timer = window.setTimeout(persist, 280);
  });

  ta.addEventListener("blur", () => {
    window.clearTimeout(timer);
    persist();
  });

  paint(ta.value ? "saved" : "saved");
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
  const limit = item.reviewLimit || 1000;
  const text = loadReviewDraft(item.id, item.review || "").slice(0, limit);
  return `
    <section class="review-body" aria-label="Review">
      <header class="review-section-head">
        <h2>Review</h2>
        <div class="review-meta">
          <span class="review-status" data-review-status data-state="saved">已保存</span>
          <span class="review-count" data-review-count>${text.length}/${limit}</span>
        </div>
      </header>
      <form class="review-editor" data-review-editor data-review-id="${escapeAttr(item.id)}" data-review-limit="${limit}">
        <label class="visually-hidden" for="review-input-${escapeAttr(item.id)}">填写乐评意见</label>
        <textarea
          id="review-input-${escapeAttr(item.id)}"
          class="review-text review-text-input"
          rows="8"
          maxlength="${limit}"
          placeholder="在这里填写乐评意见，输入后会自动保存到本机…"
        >${escapeHtml(text)}</textarea>
      </form>
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
  page.style.setProperty("--rv-glow", rgbCss(colors[3], 0.42));
  page.style.setProperty("--rv-veil", rgbCss(colors[2], 0.34));
  page.style.setProperty("--rv-panel", rgbCss(colors[0], 0.5));
  page.style.setProperty("--rv-line", rgbCss(colors[2], 0.3));
  page.style.setProperty("--rv-ring", rgbCss(colors[3], 0.88));
}

async function ensureReviewPalette(item) {
  const key = `review-deep-v2-${item.id}`;
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

function coverStem(url) {
  const src = coverUrl(url, 400);
  if (!src) return "";
  return src.replace(/\/\d+x\d+bb(\.[a-z]+)$/i, "");
}

function awardYearFavCovers(year = AWARD_EDITION.year) {
  const months = YEAR_MAP[year]?.months || [];
  const seen = new Set();
  const list = [];
  const push = (title, artist, cover, month = "") => {
    const src = coverUrl(cover, 400);
    const stem = coverStem(cover);
    if (!src || !stem || seen.has(stem)) return;
    seen.add(stem);
    list.push({ src, title: title || "", artist: artist || "", month });
  };

  for (const m of months) {
    for (const t of m.tracks || []) {
      push(t.title, t.artist, t.cover, m.labelZh || m.labelEn || "");
    }
  }
  for (const t of AWARD_EXTRA_COVERS) {
    push(t.title, t.artist, t.cover, "extra");
  }
  return list;
}

/** Avoid back-to-back identical covers, including marquee loop joints. */
function withoutAdjacentDupes(covers) {
  if (covers.length < 2) return covers.slice();
  const out = [];
  for (const item of covers) {
    if (out.length && out[out.length - 1].src === item.src) continue;
    out.push(item);
  }
  if (out.length > 2 && out[0].src === out[out.length - 1].src) {
    const last = out.pop();
    const mid = Math.max(1, Math.floor(out.length / 2));
    if (out[mid - 1]?.src !== last.src && out[mid]?.src !== last.src) {
      out.splice(mid, 0, last);
    }
  }
  return out;
}

function splitCoverRows(covers, rowCount = 4) {
  if (!covers.length) return Array.from({ length: rowCount }, () => []);
  // Shuffle-ish spread: rotate source so rows diverge visually.
  const pool = covers.slice();
  const rows = Array.from({ length: rowCount }, () => []);
  pool.forEach((c, i) => rows[i % rowCount].push(c));
  const minPerRow = 10;
  return rows.map((row, i) => {
    let out = withoutAdjacentDupes(row);
    if (!out.length) out = pool.slice();
    let cursor = i * 3;
    let guard = 0;
    while (out.length < minPerRow && guard < pool.length * 3) {
      const next = pool[cursor % pool.length];
      cursor += 1;
      guard += 1;
      if (out[out.length - 1]?.src === next.src) continue;
      out.push(next);
    }
    return withoutAdjacentDupes(out);
  });
}

function awardMarqueeRow(covers, direction, duration) {
  const tiles = covers
    .map(
      (c) => `
      <figure class="sla-tile">
        <img src="${escapeAttr(c.src)}" alt="${escapeAttr(`${c.title} — ${c.artist}`)}" loading="lazy" decoding="async" />
      </figure>`
    )
    .join("");
  return `
    <div class="sla-row is-${direction}" style="--sla-duration:${duration}s" aria-hidden="true">
      <div class="sla-track">${tiles}${tiles}</div>
    </div>
  `;
}

function awardLandingView() {
  document.title = `${AWARD_EDITION.title} ${AWARD_EDITION.year} — CHARON STUDIO`;
  document.body.dataset.page = "award-home";
  field.setMode(0);

  const covers = awardYearFavCovers(AWARD_EDITION.year);
  const rows = splitCoverRows(covers, 4);
  const durations = [48, 56, 44, 60];
  const directions = ["ltr", "rtl", "ltr", "rtl"];
  const marquee = rows
    .map((row, i) => awardMarqueeRow(row, directions[i], durations[i]))
    .join("");

  return `
    <header class="sla-top">
      <a class="sla-wordmark" href="#/studio" aria-label="返回 CHARON STUDIO 原主页">CHARON <i></i> <span>studio</span></a>
      <a class="sla-top-link" href="#/award">奖项设置</a>
    </header>
    <main class="sla-landing">
      <div class="sla-veil" aria-hidden="true"></div>
      <div class="sla-glow" aria-hidden="true"></div>
      <section class="sla-marquee" aria-hidden="true">${marquee}</section>
      <section class="sla-hero">
        <p class="sla-kicker">${escapeHtml(AWARD_EDITION.studio)} ‣ ${AWARD_EDITION.year}</p>
        <h1 class="sla-title">
          <span class="sla-title-sonic">Sonic</span>
          <span class="sla-title-luminous">Luminous</span>
          <span class="sla-title-award">Award</span>
        </h1>
        <p class="sla-sub">用音乐铭记我们的 <em>${AWARD_EDITION.year}</em></p>
        <div class="sla-actions">
          <a class="sla-btn" href="#/award">进入奖项</a>
          <a class="sla-btn is-ghost" href="#/studio">进入工作室</a>
        </div>
      </section>
    </main>
  `;
}

function awardNomineeCard(item, side, depth, rank) {
  return `
    <figure class="bmc-card" style="--bmc-depth:${depth}; --bmc-rank:${rank}" data-side="${side}">
      <div class="bmc-card-frame">
        <img src="${escapeAttr(item.cover)}" alt="${escapeAttr(`${item.artist} — ${item.work}`)}" loading="lazy" />
      </div>
      <figcaption class="bmc-card-artist">${escapeHtml(item.artist)}</figcaption>
    </figure>
  `;
}

function awardNomineeView(id) {
  const pack = getAwardNominees(id);
  if (!pack) return null;

  document.title = `${pack.en} — ${AWARD_EDITION.title} — CHARON STUDIO`;
  document.body.dataset.page = "award-nominee";
  field.setMode(0.15);

  const list = pack.nominees;
  // Always 5 left / 5 right for this category when there are 10 nominees.
  const mid = list.length === 10 ? 5 : Math.floor(list.length / 2);
  const left = list.slice(0, mid);
  const right = list.slice(mid);
  const leftCards = left
    .map((item, i) => awardNomineeCard(item, "left", left.length - i, i + 1))
    .join("");
  const rightCards = right
    .map((item, i) =>
      awardNomineeCard(item, "right", i + 1, mid + i + 1)
    )
    .join("");

  const rows = list
    .map(
      (item, i) => `
      <li class="bmc-list-row">
        <span class="bmc-list-num">${pad(i + 1)}</span>
        <img class="bmc-list-cover" src="${escapeAttr(item.cover)}" alt="" loading="lazy" />
        <div class="bmc-list-meta">
          <p class="bmc-list-artist">${escapeHtml(item.artist)}</p>
          <p class="bmc-list-work">${escapeHtml(item.work)} <span>· ${escapeHtml(item.kindZh || item.kind)}</span></p>
        </div>
      </li>`
    )
    .join("");

  return `
    ${header("award")}
    <main class="bmc-page">
      <p class="bmc-kicker">${escapeHtml(AWARD_EDITION.title)} ‣ ${pack.year}</p>
      <section class="bmc-stage" aria-label="${escapeAttr(pack.en)} nominated covers">
        <div class="bmc-rail">
          ${leftCards}
          <button type="button" class="bmc-center" data-bmc-toggle aria-expanded="false" aria-controls="bmc-list">
            <span class="bmc-center-en">${escapeHtml(pack.en)}</span>
            <span class="bmc-center-zh">${escapeHtml(pack.zh)}</span>
            <span class="bmc-center-status">${escapeHtml(pack.status)}</span>
            <span class="bmc-center-hint">点击展开提名名单</span>
          </button>
          ${rightCards}
        </div>
      </section>

      <section id="bmc-list" class="bmc-list-panel" hidden>
        <header class="bmc-list-head">
          <h2>Nominated · ${escapeHtml(pack.zh)}</h2>
          <p>${list.length} 组提名 · 按歌手首字母排序</p>
        </header>
        <ol class="bmc-list">${rows}</ol>
        <a class="bmc-back" href="#/award">← 返回奖项设置</a>
      </section>
    </main>
  `;
}

function fitBmcRail() {
  const rail = document.querySelector(".bmc-rail");
  if (!rail) return;

  const left = [...rail.querySelectorAll('.bmc-card[data-side="left"]')];
  const right = [...rail.querySelectorAll('.bmc-card[data-side="right"]')];
  const mid = rail.querySelector(".bmc-center");
  const n = Math.max(left.length, right.length, 1);
  // True viewport center — ignore right-nav chrome; keep equal L/R margins.
  const edge = 28;
  const avail = Math.max(360, window.innerWidth - edge * 2);
  const half = avail / 2;
  const titleW = Math.min(200, Math.max(152, avail * 0.12));
  // Extra pad so the title never collides with the nearest covers.
  const titleHalf = titleW / 2 + 28;
  // Prefer large equal cards; shrink step+card together if outer edges would clip.
  let card = Math.min(188, Math.max(144, avail * 0.1));
  let step = card * 0.86;
  const reach = () => titleHalf + (n - 0.5) * step + card / 2;
  if (reach() > half - 4) {
    const shrink = (half - 4) / reach();
    step *= shrink;
    card *= shrink;
  }

  rail.style.width = `${Math.round(avail)}px`;
  rail.style.height = `${Math.round(card + 72)}px`;
  rail.style.setProperty("--bmc-card", `${Math.round(card)}px`);
  rail.style.setProperty("--bmc-center", `${Math.round(titleW)}px`);

  if (mid) {
    mid.style.left = "50%";
    mid.style.top = "50%";
  }

  left.forEach((el, i) => {
    // DOM: outermost → innermost. Mirror of right side.
    const fromCenter = left.length - i;
    const x = -(titleHalf + (fromCenter - 0.5) * step);
    el.style.left = `calc(50% + ${x.toFixed(1)}px)`;
    el.style.top = "50%";
  });

  right.forEach((el, i) => {
    const fromCenter = i + 1;
    const x = titleHalf + (fromCenter - 0.5) * step;
    el.style.left = `calc(50% + ${x.toFixed(1)}px)`;
    el.style.top = "50%";
  });
}

function bindAwardNomineeToggle() {
  const btn = document.querySelector("[data-bmc-toggle]");
  const panel = document.getElementById("bmc-list");
  if (!btn || !panel) return;
  btn.addEventListener("click", () => {
    const open = panel.hasAttribute("hidden");
    if (open) {
      panel.removeAttribute("hidden");
      btn.setAttribute("aria-expanded", "true");
      btn.classList.add("is-open");
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      panel.setAttribute("hidden", "");
      btn.setAttribute("aria-expanded", "false");
      btn.classList.remove("is-open");
    }
  });
}

function awardView() {
  document.title = `${AWARD_EDITION.title}(${AWARD_EDITION.year}) — CHARON STUDIO`;
  document.body.dataset.page = "award";
  field.setMode(0.35);

  const singles = SINGLE_AWARDS.map((a, i) => {
    const href = a.id ? `#/award/${encodeURIComponent(a.id)}` : "";
    const status = a.status
      ? `<p class="award-status">${escapeHtml(a.status)}</p>`
      : "";
    const inner = `
      <span class="award-index">${pad(i + 1)}</span>
      <h3 class="award-zh">${escapeHtml(a.zh)}</h3>
      <p class="award-en">${escapeHtml(a.en)}</p>
      ${status}`;
    return href
      ? `<li class="award-item award-item-link"><a href="${href}">${inner}</a></li>`
      : `<li class="award-item">${inner}</li>`;
  }).join("");

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
    `<a class="month-chip ${allActive}" href="#${basePath}?year=ALL${suffix}">全部</a>`,
    ...YEAR_LIST.map((y) => {
      const active = y === activeYear ? "is-active" : "";
      return `<a class="month-chip ${active}" href="#${basePath}?year=${y}${suffix}">${y}</a>`;
    }),
  ];
  return `
    <nav class="month-switch archive-switch" aria-label="按年份筛选">
      <span class="month-switch-label">年份</span>
      <div class="month-chips">${years.join("")}</div>
    </nav>
  `;
}

function archiveSubnav(active) {
  const items = [
    { id: "hub", href: "#/archive", label: "总览", en: "Index" },
    { id: "stars", href: "#/archive/stars", label: "星光", en: "Stars" },
    { id: "tracks", href: "#/archive/tracks", label: "单曲", en: "Tracks" },
    { id: "albums", href: "#/archive/albums", label: "专辑", en: "Albums" },
    { id: "artists", href: "#/archive/artists", label: "艺人", en: "Artists" },
    { id: "ranks", href: "#/archive/ranks", label: "榜动", en: "Ranks" },
    { id: "seasons", href: "#/archive/seasons", label: "季节", en: "Seasons" },
    { id: "plays", href: "#/archive/plays", label: "播放", en: "Plays" },
  ];
  return `
    <nav class="archive-subnav" aria-label="档案分区">
      ${items
        .map(
          (it) =>
            `<a class="archive-subnav-link ${active === it.id ? "is-active" : ""}" href="${it.href}"><span class="archive-subnav-zh">${it.label}</span><span class="archive-subnav-en">${it.en}</span></a>`
        )
        .join("")}
    </nav>
  `;
}

function monthChipsHtml(months, limit = 8) {
  const shown = months.slice(0, limit);
  const rest = months.length - shown.length;
  const chips = shown
    .map((m) => {
      const zh = m.labelZh || m.labelEn;
      return `<a class="stats-month-chip" href="${m.href}">${escapeHtml(zh)}${String(m.year).slice(2)}</a>`;
    })
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
        <p class="kicker">档案 ‣ 统计 Archive</p>
        <h1 class="index-title">听歌账本</h1>
        <p class="index-sub">${ALL_MONTHS.length} 个月 · ${YEAR_LIST[0]}–${YEAR_LIST[YEAR_LIST.length - 1]}</p>
        <p class="archive-hero-note">这里汇总月报里的「星光艺人 / 每月最爱单曲 / 播放量」。上榜次数是进过榜的月份数，不等于播放量。</p>
      </header>

      <section class="archive-lexicon" aria-label="术语说明">
        <p class="kicker">怎么读这些词</p>
        <dl class="archive-lexicon-list">
          <div><dt>星光 / Star</dt><dd>当月主打艺人，看上榜月数与 ART 收听时长</dd></div>
          <div><dt>FAV.01–04</dt><dd>每月最爱四首歌；01 是冠军，数字越小名次越高</dd></div>
          <div><dt>ART 时长</dt><dd>该艺人在月报里的收听分钟数合计</dd></div>
          <div><dt>加权分</dt><dd>按名次加分：冠军最多，名次越后分越少</dd></div>
          <div><dt>回流</dt><dd>中间掉出榜单，后来又重新上榜</dd></div>
        </dl>
      </section>

      <section class="archive-gate" aria-label="档案分区">
        <a class="archive-gate-card" href="#/archive/stars">
          <p class="kicker">01 ‣ 星光堂</p>
          <h2>每月星光艺人</h2>
          <p class="archive-gate-note">${starN} 位 · 比谁当过更多月的星光，以及听了多久</p>
        </a>
        <a class="archive-gate-card" href="#/archive/tracks">
          <p class="kicker">02 ‣ 单曲榜</p>
          <h2>上榜最爱单曲</h2>
          <p class="archive-gate-note">${trackN} 首 · 进过 FAV.01–04 的次数</p>
        </a>
        <a class="archive-gate-card" href="#/archive/albums">
          <p class="kicker">03 ‣ 专辑堂</p>
          <h2>上榜专辑</h2>
          <p class="archive-gate-note">${albumN} 张 · 专辑被 FAV 曲目带到榜上的次数</p>
        </a>
        <a class="archive-gate-card" href="#/archive/artists">
          <p class="kicker">04 ‣ 艺人榜</p>
          <h2>FAV + 星光综合</h2>
          <p class="archive-gate-note">${artistN} 位 · 单曲上榜分 + 星光月数一起算</p>
        </a>
        <a class="archive-gate-card" href="#/archive/ranks">
          <p class="kicker">05 ‣ 榜动</p>
          <h2>连冠与攀升</h2>
          <p class="archive-gate-note">${rankN} 首 · 跨月连续上榜、名次变化、掉榜再回</p>
        </a>
        <a class="archive-gate-card" href="#/archive/seasons">
          <p class="kicker">06 ‣ 季节</p>
          <h2>春夏秋冬 / 半年</h2>
          <p class="archive-gate-note">${seasonPack.seasons.length} 季 · ${seasonPack.halves.length} 个半年，看各季听谁最多</p>
        </a>
        <a class="archive-gate-card" href="#/archive/plays">
          <p class="kicker">07 ‣ 播放量</p>
          <h2>每月听歌量</h2>
          <p class="archive-gate-note">合计 ${plays.total.toLocaleString()} 次 · 峰值 ${escapeHtml(plays.peak?.label || "—")}</p>
        </a>
      </section>

      <section class="archive-wrap">
        <p class="kicker">最新年份速览 ‣ ${wrap.year}</p>
        <dl class="archive-wrap-list">
          <div>
            <dt>星光王</dt>
            <dd>${wrap.starKing ? escapeHtml(`${wrap.starKing.artist} · ${wrap.starKing.count} 个月`) : "—"}</dd>
          </div>
          <div>
            <dt>单曲王</dt>
            <dd>${
              wrap.trackKing
                ? escapeHtml(`${wrap.trackKing.title} · 上榜 ${wrap.trackKing.appearances} 月`)
                : "—"
            }</dd>
          </div>
          <div>
            <dt>峰值月</dt>
            <dd>${
              wrap.peakMonth
                ? `<a href="${wrap.peakMonth.href}">${escapeHtml(wrap.peakMonth.label)} · ${wrap.peakMonth.plays.toLocaleString()} 次</a>`
                : "—"
            }</dd>
          </div>
          <div>
            <dt>年播放量</dt>
            <dd>${wrap.totalPlays.toLocaleString()} 次</dd>
          </div>
        </dl>
      </section>

      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>数据来自现有月报</span>
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
            当过星光 <strong>${r.count}</strong> 个月
            · 收听合计 ${formatArtTime(r.artMinutesTotal)}
            · 月均 ${formatArtTime(Math.round(r.artMinutesAvg))}
            · 单月最高 ${formatArtTime(r.artMinutesPeak)}
          </p>
          <p class="stats-line muted">
            最近一次 <a href="${r.lastHref}">${escapeHtml(r.lastId)}</a>
            · 同月也有 FAV 单曲 ${r.favIntersectionMonths}/${r.count} 个月
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
        <p class="kicker">档案 ‣ 星光堂</p>
        <h1 class="index-title">星光艺人</h1>
        <p class="index-sub">${rows.length} 位 · 只统计每月「星光」主打艺人</p>
        <p class="archive-hero-note">「按月数」看谁当过更多次星光；「按收听时长」看星光月里听了多久（ART）。</p>
        <div class="stats-mode" role="group" aria-label="星光堂排序">
          <a class="month-chip ${mode === "count" ? "is-active" : ""}" href="#/archive/stars?year=${year}&sort=count">按月数</a>
          <a class="month-chip ${mode === "minutes" ? "is-active" : ""}" href="#/archive/stars?year=${year}&sort=minutes">按收听时长</a>
        </div>
      </header>
      <section class="stats-list">${list || `<p class="archive-empty">当前筛选下暂无星光艺人。</p>`}</section>
      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>星光堂</span>
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
            上榜 <strong>${r.appearances}</strong> 个月
            · 当过冠军 <strong>${r.numberOnes}</strong> 个月
            · 加权分 ${r.weighted}
            ${r.isComeback ? " · 曾掉榜再回流" : ""}
          </p>
          <p class="stats-note muted">上榜 = 进入当月最爱 FAV.01–04 的月份数，不是播放次数。</p>
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
        <p class="kicker">档案 ‣ 单曲榜</p>
        <h1 class="index-title">上榜最爱单曲</h1>
        <p class="index-sub">显示前 ${cap} / 共 ${all.length} 首</p>
        <p class="archive-hero-note">「上榜」按进过 FAV 的月份数；「冠军月」是当过 FAV.01；「加权分」名次越高加分越多。</p>
        <div class="stats-mode" role="group" aria-label="单曲排序">
          <a class="month-chip ${mode === "appearances" ? "is-active" : ""}" href="#/archive/tracks?${yq}&sort=appearances&limit=${cap}">上榜月数</a>
          <a class="month-chip ${mode === "numberOnes" ? "is-active" : ""}" href="#/archive/tracks?${yq}&sort=numberOnes&limit=${cap}">冠军月数</a>
          <a class="month-chip ${mode === "weighted" ? "is-active" : ""}" href="#/archive/tracks?${yq}&sort=weighted&limit=${cap}">加权分</a>
        </div>
        <div class="stats-mode" role="group" aria-label="列表长度">
          <a class="month-chip ${cap === 10 ? "is-active" : ""}" href="#/archive/tracks?${yq}&sort=${mode}&limit=10">前 10</a>
          <a class="month-chip ${cap === 20 ? "is-active" : ""}" href="#/archive/tracks?${yq}&sort=${mode}&limit=20">前 20</a>
        </div>
      </header>
      <section class="stats-list">${list || `<p class="archive-empty">当前筛选下暂无单曲。</p>`}</section>
      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>单曲榜</span>
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
            被带到榜上 <strong>${r.appearances}</strong> 次
            · 冠军曲所属 <strong>${r.numberOnes}</strong> 个月
            · 覆盖 ${r.uniqueMonths} 个月
            · 相关曲目 ${r.trackCount} 首
            · 加权分 ${r.weighted}
          </p>
          <p class="stats-note muted">按 FAV 曲目填写的专辑名汇总，不是单独的专辑榜投票。</p>
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
        <p class="kicker">档案 ‣ 专辑堂</p>
        <h1 class="index-title">上榜专辑</h1>
        <p class="index-sub">显示前 ${cap} / 共 ${all.length} 张</p>
        <p class="archive-hero-note">某张专辑里的歌进了当月最爱，这张专辑就算上榜一次；冠军月 = 有曲目拿过 FAV.01。</p>
        <div class="stats-mode" role="group" aria-label="专辑排序">
          <a class="month-chip ${mode === "appearances" ? "is-active" : ""}" href="#/archive/albums?${yq}&sort=appearances&limit=${cap}">上榜次数</a>
          <a class="month-chip ${mode === "numberOnes" ? "is-active" : ""}" href="#/archive/albums?${yq}&sort=numberOnes&limit=${cap}">冠军月数</a>
          <a class="month-chip ${mode === "weighted" ? "is-active" : ""}" href="#/archive/albums?${yq}&sort=weighted&limit=${cap}">加权分</a>
        </div>
        <div class="stats-mode" role="group" aria-label="列表长度">
          <a class="month-chip ${cap === 10 ? "is-active" : ""}" href="#/archive/albums?${yq}&sort=${mode}&limit=10">前 10</a>
          <a class="month-chip ${cap === 20 ? "is-active" : ""}" href="#/archive/albums?${yq}&sort=${mode}&limit=20">前 20</a>
        </div>
      </header>
      <section class="stats-list">${list || `<p class="archive-empty">当前筛选下暂无专辑。</p>`}</section>
      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>专辑堂</span>
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
            FAV 上榜记分 <strong>${r.favAppearances}</strong>
            · 冠军 <strong>${r.numberOnes}</strong> 个月
            · 加权分 ${r.weighted}
            · 星光 ${r.starCount} 个月
            ${r.starCount ? `· 收听 ${formatArtTime(r.artMinutesTotal)}` : ""}
            ${r.isStarOnly ? " · 只当过星光、未进 FAV" : ""}
          </p>
          <p class="stats-line muted">覆盖 ${r.uniqueMonths} 个月 · 合作曲会按「/」与 feat. 拆给每位艺人</p>
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
        <p class="kicker">档案 ‣ 艺人榜</p>
        <h1 class="index-title">艺人综合积分</h1>
        <p class="index-sub">显示前 ${cap} / 共 ${all.length} 位</p>
        <p class="archive-hero-note">比星光堂更宽：把 FAV 单曲上榜分和星光月数合在一起。加权分优先看名次含金量。</p>
        <div class="stats-mode" role="group" aria-label="艺人排序">
          <a class="month-chip ${mode === "weighted" ? "is-active" : ""}" href="#/archive/artists?${yq}&sort=weighted&limit=${cap}">加权分</a>
          <a class="month-chip ${mode === "fav" ? "is-active" : ""}" href="#/archive/artists?${yq}&sort=fav&limit=${cap}">FAV 次数</a>
          <a class="month-chip ${mode === "ones" ? "is-active" : ""}" href="#/archive/artists?${yq}&sort=ones&limit=${cap}">冠军月数</a>
          <a class="month-chip ${mode === "star" ? "is-active" : ""}" href="#/archive/artists?${yq}&sort=star&limit=${cap}">星光月数</a>
        </div>
        <div class="stats-mode" role="group" aria-label="列表长度">
          <a class="month-chip ${cap === 10 ? "is-active" : ""}" href="#/archive/artists?${yq}&sort=${mode}&limit=10">前 10</a>
          <a class="month-chip ${cap === 20 ? "is-active" : ""}" href="#/archive/artists?${yq}&sort=${mode}&limit=20">前 20</a>
        </div>
      </header>
      <section class="stats-list">${list || `<p class="archive-empty">当前筛选下暂无艺人。</p>`}</section>
      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>艺人榜</span>
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
            最长连续上榜 <strong>${r.boardStreak}</strong> 个月
            · 最长连冠 <strong>${r.oneStreak}</strong> 个月
            · 最大攀升 <strong>${r.bestClimb}</strong> 名
            · 掉榜最长间隔 <strong>${r.maxGap}</strong> 个月
          </p>
          <p class="stats-line muted">共上榜 ${r.appearances} 个月 · 名次轨迹 ${escapeHtml(rankTrail)}${(r.ranks || []).length > 8 ? " …" : ""}</p>
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
        <p class="kicker">档案 ‣ 榜动</p>
        <h1 class="index-title">连冠与攀升</h1>
        <p class="index-sub">显示前 ${cap} / 共 ${all.length} 首 · 至少上榜过 2 个月</p>
        <p class="archive-hero-note">「连续上榜」看连着几个月都在 FAV；「连冠」看连着几个月拿 FAV.01；「攀升」是名次往前跳了几位；「回流间隔」是掉榜后又隔了多久回来。</p>
        <div class="stats-mode" role="group" aria-label="榜动排序">
          <a class="month-chip ${mode === "board" ? "is-active" : ""}" href="#/archive/ranks?${yq}&sort=board&limit=${cap}">连续上榜</a>
          <a class="month-chip ${mode === "ones" ? "is-active" : ""}" href="#/archive/ranks?${yq}&sort=ones&limit=${cap}">连冠</a>
          <a class="month-chip ${mode === "climb" ? "is-active" : ""}" href="#/archive/ranks?${yq}&sort=climb&limit=${cap}">最大攀升</a>
          <a class="month-chip ${mode === "gap" ? "is-active" : ""}" href="#/archive/ranks?${yq}&sort=gap&limit=${cap}">回流间隔</a>
        </div>
        <div class="stats-mode" role="group" aria-label="列表长度">
          <a class="month-chip ${cap === 10 ? "is-active" : ""}" href="#/archive/ranks?${yq}&sort=${mode}&limit=10">前 10</a>
          <a class="month-chip ${cap === 20 ? "is-active" : ""}" href="#/archive/ranks?${yq}&sort=${mode}&limit=20">前 20</a>
        </div>
      </header>
      <section class="stats-list">${list || `<p class="archive-empty">当前筛选下暂无跨月单曲。</p>`}</section>
      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>榜动</span>
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
          <p class="kicker">${escapeHtml(s.labelZh)}季 ‣ ${escapeHtml(s.labelEn)}</p>
          <h2 class="stats-title">${escapeHtml(s.monthsLabel)}</h2>
          <p class="stats-line">
            覆盖 <strong>${s.monthCount}</strong> 个月
            · 播放合计 ${s.totalPlays.toLocaleString()} 次
            · 月均 ${s.avgPlays.toLocaleString()} 次
          </p>
          <p class="stats-line">
            本季星光最多 · ${s.topStar ? escapeHtml(`${s.topStar.artist} · ${s.topStar.count} 个月`) : "—"}
          </p>
          <p class="stats-line">
            本季 FAV.01 最多 · ${
              s.topTrack
                ? escapeHtml(`${s.topTrack.title} · ${s.topTrack.count} 次`)
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
          <strong>${h.monthCount}</strong> 个月
          · 播放 ${h.totalPlays.toLocaleString()} 次
          · 月均 ${h.avgPlays.toLocaleString()} 次
        </p>
        <p class="stats-line muted">
          星光领先 · ${h.topStar ? escapeHtml(`${h.topStar.artist} · ${h.topStar.count} 个月`) : "—"}
          · FAV.01 领先 · ${h.topTrack ? escapeHtml(`${h.topTrack.title} · ${h.topTrack.count} 次`) : "—"}
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
        <p class="kicker">档案 ‣ 季节</p>
        <h1 class="index-title">季节与半年</h1>
        <p class="index-sub">${year === "ALL" ? "全部年份" : `${year} 年`} · 按播放量 / 星光 / 冠军曲汇总</p>
        <p class="archive-hero-note">春 3–5 月，夏 6–8 月，秋 9–11 月，冬 12–2 月；上半年 1–6 月，下半年 7–12 月。</p>
      </header>
      <section class="season-grid" aria-label="四季">
        ${seasonCards || `<p class="archive-empty">当前筛选下暂无季节数据。</p>`}
      </section>
      <section class="season-half-grid" aria-label="半年">
        ${halfCards}
      </section>
      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>季节</span>
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
      <a class="plays-bar ${mark}" href="${p.href}" style="--h:${h}%" title="${escapeAttr(`${p.labelZh || p.labelEn} ${p.year}：${p.plays} 次播放`)}">
        <span class="plays-bar-fill"></span>
        <span class="plays-bar-label">${escapeHtml(p.labelZh || p.labelEn.slice(0, 1))}${String(p.year).slice(2)}</span>
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
        <p class="kicker">档案 ‣ 播放量</p>
        <h1 class="index-title">每月听歌量</h1>
        <p class="index-sub">
          ${series.points.length} 个月 · 合计 ${series.total.toLocaleString()} 次
          · 最高 <a href="${series.peak?.href || "#"}">${escapeHtml(series.peak?.label || "—")}</a>
          · 最低 <a href="${series.trough?.href || "#"}">${escapeHtml(series.trough?.label || "—")}</a>
        </p>
        <p class="archive-hero-note">柱高代表当月播放次数。高亮是峰值月，低谷是播放最少的月份；点柱可跳到对应月报。</p>
      </header>
      <section class="plays-strip" aria-label="每月播放量时间线">
        ${bars || `<p class="archive-empty">当前筛选下暂无播放数据。</p>`}
      </section>
      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>播放量</span>
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
    bindReviewEditor();
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
    bindReviewEditor();
    const colors = await ensureReviewPalette(item);
    if (parseRoute().name === "review-detail") {
      field.setPalette(colors);
      applyReviewTheme(colors);
    }
  } else if (route.name === "award") {
    app.innerHTML = awardView();
    const colors = await ensureHomePalette();
    if (parseRoute().name === "award") field.setPalette(colors);
  } else if (route.name === "award-nominee") {
    const html = awardNomineeView(route.id);
    if (!html) {
      location.hash = "#/award";
      return;
    }
    app.innerHTML = html;
    bindAwardNomineeToggle();
    const runFit = () => fitBmcRail();
    requestAnimationFrame(() => {
      runFit();
      requestAnimationFrame(runFit);
    });
    document.querySelectorAll(".bmc-card-frame img").forEach((img) => {
      if (img.complete) return;
      img.addEventListener("load", runFit, { once: true });
    });
    const colors = await ensureHomePalette();
    if (parseRoute().name === "award-nominee") field.setPalette(colors);
  } else if (route.name === "home") {
    app.innerHTML = homeView();
    requestAnimationFrame(fitMast);
    const colors = await ensureHomePalette();
    if (parseRoute().name === "home") field.setPalette(colors);
  } else {
    app.innerHTML = awardLandingView();
    field.setPalette(HOME_PALETTE);
  }
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", () => {
  render();
});
window.addEventListener("resize", () => {
  if (document.body.dataset.page === "home") fitMast();
  if (document.body.dataset.page === "award-nominee") fitBmcRail();
});
render();
