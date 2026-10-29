function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function sampleCover(url, size = 36) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const buckets = new Map();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 180) continue;
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          if (lum < 18 || lum > 245) continue;
          const key = `${r >> 4},${g >> 4},${b >> 4}`;
          const prev = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
          prev.r += r;
          prev.g += g;
          prev.b += b;
          prev.n += 1;
          buckets.set(key, prev);
        }
        const ranked = [...buckets.values()]
          .map((v) => ({
            r: v.r / v.n / 255,
            g: v.g / v.n / 255,
            b: v.b / v.n / 255,
            n: v.n,
            sat: (() => {
              const max = Math.max(v.r, v.g, v.b) / 255;
              const min = Math.min(v.r, v.g, v.b) / 255;
              return max - min;
            })(),
          }))
          .sort((a, b) => b.sat * b.n - a.sat * a.n);
        resolve(ranked[0] ? [ranked[0].r, ranked[0].g, ranked[0].b] : null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function boost(rgb, amount = 0.18) {
  return rgb.map((c) => Math.min(1, c * (1 + amount) + 0.04));
}

function deepen(rgb) {
  // keep chroma, pull toward a richer mid for the shader field
  return [
    Math.max(0.05, Math.min(0.82, rgb[0] * 0.55 + 0.07)),
    Math.max(0.04, Math.min(0.78, rgb[1] * 0.45 + 0.04)),
    Math.max(0.06, Math.min(0.82, rgb[2] * 0.55 + 0.08)),
  ];
}

export function paletteFromHues(tracks) {
  const hues = tracks.map((t) => hexToRgb(t.hue));
  const pick = (i) => hues[Math.min(i, hues.length - 1)];
  const a = pick(0);
  const b = pick(Math.floor(hues.length * 0.35));
  const c = pick(Math.floor(hues.length * 0.7));
  const d = pick(hues.length - 1);
  return [
    deepen(a),
    boost(b, 0.2),
    boost(c, 0.16),
    boost(d, 0.22),
  ];
}

export async function paletteFromTracks(tracks) {
  const fallback = paletteFromHues(tracks);
  const unique = [...new Map(tracks.map((t) => [t.cover, t])).values()];
  const sampled = await Promise.all(unique.map((t) => sampleCover(t.cover)));
  const colors = [];
  unique.forEach((t, i) => {
    colors.push(sampled[i] || hexToRgb(t.hue));
  });
  while (colors.length < 4) {
    colors.push(colors[colors.length - 1] || fallback[colors.length] || [0.7, 0.4, 0.55]);
  }
  const step = Math.max(1, Math.floor(colors.length / 4));
  const mixed = [0, 1, 2, 3].map((i) => {
    const c = colors[Math.min(i * step, colors.length - 1)];
    // blend sampled color with hue fallback so month still feels distinct
    return [
      c[0] * 0.7 + fallback[i][0] * 0.3,
      c[1] * 0.7 + fallback[i][1] * 0.3,
      c[2] * 0.7 + fallback[i][2] * 0.3,
    ];
  });
  return mixed;
}

export const HOME_PALETTE = [
  [0.05, 0.1, 0.26],
  [0.12, 0.28, 0.62],
  [0.36, 0.62, 0.62],
  [0.78, 0.28, 0.07],
];

function mix3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** Home field: keep nocturnal base, blend in current month FAV.01 cover chroma. */
export async function paletteFromHomeTrack(track) {
  const base = HOME_PALETTE.map((c) => [...c]);
  if (!track) return base;

  const sampled = track.cover ? await sampleCover(track.cover) : null;
  const accent = sampled || (track.hue ? hexToRgb(track.hue) : null);
  if (!accent) return base;

  const deep = deepen(accent);
  const hot = boost(accent, 0.28);
  const mid = boost(accent, 0.12);
  const cool = deepen(
    mix3(accent, [accent[2], accent[0], accent[1]], 0.35)
  );

  return [
    mix3(base[0], deep, 0.72),
    mix3(base[1], mid, 0.68),
    mix3(base[2], cool, 0.62),
    mix3(base[3], hot, 0.78),
  ];
}
