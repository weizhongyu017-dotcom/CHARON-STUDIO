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
  [0.12, 0.18, 0.34],
  [0.22, 0.4, 0.72],
  [0.48, 0.7, 0.68],
  [0.86, 0.42, 0.16],
];

function mix3(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** Lift toward a clearer mid so cover chroma survives the field's dark grade. */
function lift(rgb, amount = 0.28) {
  return rgb.map((c) => Math.min(0.94, c * (1 - amount * 0.35) + amount * 0.72));
}

/** Home field: FAV.01 cover leads; light atmospheric veil instead of deep night. */
export async function paletteFromHomeTrack(track) {
  const base = HOME_PALETTE.map((c) => [...c]);
  if (!track) return base;

  const sampled = track.cover ? await sampleCover(track.cover) : null;
  const accent = sampled || (track.hue ? hexToRgb(track.hue) : null);
  if (!accent) return base;

  const soft = lift(accent, 0.34);
  const mid = boost(accent, 0.22);
  const hot = boost(accent, 0.38);
  const cool = lift(mix3(accent, [accent[2], accent[0], accent[1]], 0.28), 0.24);

  return [
    mix3(base[0], soft, 0.9),
    mix3(base[1], mid, 0.92),
    mix3(base[2], cool, 0.88),
    mix3(base[3], hot, 0.94),
  ];
}

function deepenMore(rgb) {
  return [
    Math.max(0.03, Math.min(0.55, rgb[0] * 0.38 + 0.03)),
    Math.max(0.03, Math.min(0.5, rgb[1] * 0.32 + 0.025)),
    Math.max(0.04, Math.min(0.55, rgb[2] * 0.38 + 0.035)),
  ];
}

function satOf(rgb) {
  const max = Math.max(rgb[0], rgb[1], rgb[2]);
  const min = Math.min(rgb[0], rgb[1], rgb[2]);
  return max - min;
}

function nightTone(rgb, depth = 0.42) {
  // Keep cover hue, pull into a readable nocturnal mid instead of purple mush.
  const ink = [0.02, 0.025, 0.04];
  const kept = [
    Math.max(0.04, Math.min(0.72, rgb[0] * 0.62 + 0.05)),
    Math.max(0.04, Math.min(0.7, rgb[1] * 0.58 + 0.04)),
    Math.max(0.05, Math.min(0.74, rgb[2] * 0.64 + 0.06)),
  ];
  return mix3(ink, kept, depth);
}

function sampleCoverMany(url, size = 40, limit = 5) {
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
          if (lum < 14 || lum > 248) continue;
          const key = `${r >> 4},${g >> 4},${b >> 4}`;
          const prev = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
          prev.r += r;
          prev.g += g;
          prev.b += b;
          prev.n += 1;
          buckets.set(key, prev);
        }
        const ranked = [...buckets.values()]
          .map((v) => {
            const rgb = [v.r / v.n / 255, v.g / v.n / 255, v.b / v.n / 255];
            return { rgb, n: v.n, sat: satOf(rgb) };
          })
          .sort((a, b) => b.sat * 1.4 * b.n + b.n - (a.sat * 1.4 * a.n + a.n));

        const picked = [];
        for (const row of ranked) {
          if (picked.length >= limit) break;
          const far = picked.every((p) => {
            const dr = p[0] - row.rgb[0];
            const dg = p[1] - row.rgb[1];
            const db = p[2] - row.rgb[2];
            return dr * dr + dg * dg + db * db > 0.028;
          });
          if (far || !picked.length) picked.push(row.rgb);
        }
        resolve(picked);
      } catch {
        resolve([]);
      }
    };
    img.onerror = () => resolve([]);
    img.src = url;
  });
}

/**
 * Album review field: multi-swatch from cover, nocturnal but hue-faithful.
 * Low-chroma covers (B&W) get a graphite silver field instead of home blue bleed.
 */
export async function paletteFromCoverDeep(coverUrl) {
  const swatches = coverUrl ? await sampleCoverMany(coverUrl) : [];
  const accent = swatches[0] || [0.28, 0.42, 0.62];
  const second = swatches[1] || mix3(accent, [accent[2], accent[0], accent[1]], 0.35);
  const third = swatches[2] || mix3(accent, second, 0.5);
  const mono = satOf(accent) < 0.08 && satOf(second) < 0.1;

  if (mono) {
    return [
      [0.05, 0.055, 0.07],
      [0.14, 0.15, 0.18],
      [0.28, 0.3, 0.34],
      [0.62, 0.64, 0.68],
    ];
  }

  const deep = nightTone(accent, 0.5);
  const mid = nightTone(boost(second, 0.12), 0.62);
  const cool = nightTone(third, 0.58);
  const hot = mix3(nightTone(accent, 0.72), boost(accent, 0.28), 0.55);

  // Tiny home blend only for air — cover hue stays dominant.
  return [
    mix3(HOME_PALETTE[0], deep, 0.94),
    mix3(HOME_PALETTE[1], mid, 0.9),
    mix3(HOME_PALETTE[2], cool, 0.88),
    mix3(HOME_PALETTE[3], hot, 0.92),
  ];
}
