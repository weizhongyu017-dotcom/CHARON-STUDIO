import { startField } from "./field.js";
import {
  HOME_PALETTE,
  paletteFromHomeTrack,
  paletteFromHues,
  paletteFromTracks,
} from "./palette.js";
import {
  LATEST_MONTH,
  YEAR_MAP,
  YEARS,
  findMonth,
  monthsForYear,
} from "./data/catalog.js";
import { monthlyNewsIds, newsItems } from "./data/news.js";

const app = document.querySelector("#app");
const field = startField(document.querySelector("#field"));

const LATEST = LATEST_MONTH;
const CURRENT_FAV = LATEST?.tracks?.[0] || null;
const MONTHLY_NEWS = monthlyNewsIds
  .map((id) => newsItems[id])
  .filter(Boolean);
const LATEST_NEWS = MONTHLY_NEWS[0] || null;
const YEAR_LIST = YEARS.map((y) => y.year);

function findNews(id) {
  return newsItems[id] || null;
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
    <article class="track star-in-month">
      <button class="track-head" type="button" aria-expanded="false" aria-label="Reveal monthly star — tap or hover">
        <span class="rank">★</span>
        <span class="track-artist star-artist-mask">MONTHLY STAR</span>
        <span class="track-hint" aria-hidden="true">↓</span>
      </button>
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

function parseRoute() {
  const p = path();
  if (p === "/" || p === "") return { name: "home" };
  const newsDetail = p.match(/^\/monthly-news\/([^/]+)$/);
  if (newsDetail) {
    return { name: "news-detail", id: decodeURIComponent(newsDetail[1]) };
  }
  if (p === "/monthly-news" || p === "/monthly-news/") {
    return { name: "news-index" };
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
  return `
    <header class="site-header">
      <a class="wordmark" href="#/" aria-label="CHARON STUDIO home">CHARON <i></i> <span>studio</span></a>
      <nav class="nav-cols" aria-label="Primary">
        <ul class="nav-list">
          <li><a href="#/monthly-news" class="${page === "news" ? "is-active" : ""}">Monthly News</a></li>
          <li><a href="#/monthly-report" class="${page === "report" ? "is-active" : ""}">Monthly Report</a></li>
          <li><a href="#/monthly-report/star" class="${page === "star" ? "is-active" : ""}">Star</a></li>
        </ul>
      </nav>
    </header>
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
  const tone = [
    item.tone === "crimson" ? "is-crimson" : "",
    item.lettered ? "is-lettered" : "",
  ]
    .filter(Boolean)
    .map((c) => ` ${c}`)
    .join("");
  const pos = item.objectPosition
    ? ` style="--news-pos: ${escapeAttr(item.objectPosition)}"`
    : "";
  const anchor = opts.first ? ' id="now"' : "";
  return `
    <article${anchor} class="home-news home-news-poster${tone}" aria-label="${escapeAttr(item.kicker || "Monthly News")}">
      <div class="news-poster-media"${pos}>
        <img src="${escapeAttr(item.image)}" alt="${escapeAttr(alt)}" loading="${opts.first ? "eager" : "lazy"}" />
        <div class="news-poster-veil" aria-hidden="true"></div>
      </div>
      <div class="news-poster-copy">
        <p class="kicker">${escapeHtml(item.kicker)}</p>
        <p class="news-poster-date">${escapeHtml(item.date)}</p>
        <h2 class="news-poster-title">
          <span class="news-poster-title-zh">${escapeHtml(item.title)}</span>
          <span class="news-poster-title-en">${escapeHtml(item.titleEn || "")}</span>
        </h2>
        <p class="news-poster-sub">${escapeHtml(item.subtitle || "")}</p>
        <div class="news-poster-venue">
          <span>${escapeHtml(item.venue || "")}</span>
          <span>${escapeHtml(item.venueEn || "")}</span>
        </div>
        <p class="news-poster-note">${escapeHtml(item.note || "")}</p>
      </div>
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
  return `
    <section class="monthly-news" aria-label="Latest Monthly News">
      ${newsItemView(LATEST_NEWS, 0)}
      <div class="news-home-more">
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

function reportIndexView(year) {
  const y = YEAR_MAP[year] ? year : LATEST.year;
  const months = monthsForYear(y);
  document.title = `MONTHLY REPORT ${y} — CHARON STUDIO`;
  document.body.dataset.page = "report";
  field.setMode(1);
  const paletteSource = months[months.length - 1] || LATEST;
  field.setPalette(paletteFromHues(paletteSource.tracks));

  const cards = months
    .map((m) => {
      const top = m.tracks[0];
      const starName = m.star?.artist || "—";
      return `
      <a class="month-card" href="#/monthly-report/${m.year}/${pad(m.month)}">
        <div class="month-card-cover">
          <img src="${coverUrl(top.cover)}" alt="${escapeAttr(top.title)} cover" loading="lazy" />
        </div>
        <div class="month-card-meta">
          <p class="kicker">${m.labelZh} ‣ ${m.labelEn}</p>
          <h2>${escapeHtml(top.title)}</h2>
          <p class="track-meta">${escapeHtml(top.artist)}</p>
          <p class="track-meta">${m.plays} plays · ${formatDeltaShort(m.delta)}</p>
          <p class="track-meta month-card-star">Star ‣ ${escapeHtml(starName)}</p>
        </div>
      </a>
    `;
    })
    .join("");

  const latestHref = `#/monthly-report/${LATEST.year}/${pad(LATEST.month)}`;

  return `
    ${header("report")}
    <main class="report report-index">
      ${archiveSwitcher(y, null)}
      <div class="archive-lead">
        <p class="kicker">Monthly Report ‣ ${y}</p>
        <a class="archive-latest" href="${latestHref}">Open latest month → ${LATEST.labelEn} ${LATEST.year}</a>
      </div>
      <section class="month-grid">${cards}</section>
      <footer class="site-footer">
        <span>CHARON STUDIO</span>
        <span>${y} archive · ${months.length} months</span>
      </footer>
    </main>
  `;
}

function starArchiveSwitcher(activeYear) {
  const yearLinks = YEAR_LIST.map((y) => {
    const active = y === activeYear ? "is-active" : "";
    return `<a class="month-chip ${active}" href="#/monthly-report/star/${y}">${y}</a>`;
  }).join("");

  return `
    <nav class="month-switch archive-switch" aria-label="Star archive years">
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
        <p class="kicker">Monthly Star ‣ ${y}</p>
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
            <dd>★<small>点按 / 悬停揭晓</small></dd>
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
  const items = [...document.querySelectorAll(selector)];
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
    const months = monthsForYear(year);
    const sample = months[months.length - 1] || LATEST;
    const colors = await ensurePalette(`index-${year}`, sample.tracks);
    if (parseRoute().name === "report-index") field.setPalette(colors);
  } else if (route.name === "star") {
    const year = route.year || LATEST.year;
    app.innerHTML = starView(year);
    const months = monthsForYear(year);
    const sample = months[months.length - 1] || LATEST;
    const colors = await ensurePalette(`star-${year}`, sample.tracks);
    if (parseRoute().name === "star") field.setPalette(colors);
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
