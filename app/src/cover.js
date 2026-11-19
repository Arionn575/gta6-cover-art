// Neon Cover Studio — the cover renderer.
//
// Draws a multi-panel GTA-style poster cover onto any 2D canvas: photo
// panels with a different crop per panel, a neon-sunset grade with
// halftone print dots, and bold condensed caption lettering. Pure
// drawing, no DOM and no network: give it a canvas, a state object
// and a size, and it paints the cover at that size.

/** The export sizes the app offers, in pixels. */
export const SIZES = {
  square: { w: 1080, h: 1080, label: 'Square 1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait 1080 × 1350' },
  wide: { w: 1920, h: 1080, label: 'Wide 1920 × 1080' },
};

/** The panel layouts, each a grid of panels over the cover. */
export const LAYOUTS = {
  vice: { name: 'Vice Grid', panels: 3 },
  strip: { name: 'Sunset Strip', panels: 4 },
  poster: { name: 'Poster 2 × 2', panels: 4 },
};

/** Title colour themes: the fill the caption is painted with. */
export const THEMES = {
  white: { name: 'White' },
  sunset: { name: 'Sunset' },
  neon: { name: 'Neon Pink' },
  gold: { name: 'Gold' },
};

/** Default crop for a panel when one photo fills the whole cover. */
export function defaultCrop(index) {
  const crops = [
    { src: 0, fx: 0.5, fy: 0.45, zoom: 1.0 },
    { src: 0, fx: 0.24, fy: 0.5, zoom: 1.45 },
    { src: 0, fx: 0.68, fy: 0.55, zoom: 1.3 },
    { src: 0, fx: 0.5, fy: 0.3, zoom: 1.9 },
  ];
  return { ...crops[index % crops.length] };
}

/**
 * The panel rectangles for a layout, as fractions of the cover.
 * Each panel is { x, y, w, h } in 0..1, the title scrim covering the
 * lower part of the art. Gutters are applied by the painter.
 */
export function layoutPanels(layout, w, h) {
  const g = Math.max(6, Math.round(Math.min(w, h) * 0.008));
  const gx = g / w;
  const gy = g / h;
  if (layout === 'strip') {
    return [
      { x: 0, y: 0, w: 1, h: 0.52 },
      { x: 0, y: 0.52, w: 1 / 3, h: 0.48 },
      { x: 1 / 3, y: 0.52, w: 1 / 3, h: 0.48 },
      { x: 2 / 3, y: 0.52, w: 1 / 3, h: 0.48 },
    ].map((r) => inset(r, gx, gy));
  }
  if (layout === 'poster') {
    return [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ].map((r) => inset(r, gx, gy));
  }
  return [
    { x: 0, y: 0, w: 0.62, h: 1 },
    { x: 0.62, y: 0, w: 0.38, h: 0.5 },
    { x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
  ].map((r) => inset(r, gx, gy));
}

function inset(r, gx, gy) {
  return { x: r.x + gx / 2, y: r.y + gy / 2, w: r.w - gx, h: r.h - gy };
}

/** Paints the whole cover onto `canvas` from `state` (see main.js). */
export function drawCover(canvas, state) {
  const size = SIZES[state.sizeKey] ?? SIZES.square;
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  const { w, h } = size;

  // The cream frame the panels sit in.
  ctx.fillStyle = '#f5efe4';
  ctx.fillRect(0, 0, w, h);

  const rects = layoutPanels(state.layoutKey, w, h);
  const panels = state.panels ?? [];
  rects.forEach((r, i) => {
    const cfg = panels[i] ?? defaultCrop(i);
    const photo = state.photos[cfg.src ?? 0] ?? null;
    const px = Math.round(r.x * w);
    const py = Math.round(r.y * h);
    const pw = Math.round(r.w * w);
    const ph = Math.round(r.h * h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();
    if (photo) drawPhotoPanel(ctx, photo.img, px, py, pw, ph, cfg, state.grade);
    else drawSunsetPanel(ctx, px, py, pw, ph, i, state.grade);
    ctx.restore();
    ctx.strokeStyle = 'rgba(20, 8, 30, 0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
  });

  drawCaption(ctx, w, h, state);
}

/** Draws one photo into a panel, cover-fit at the panel's crop. */
function drawPhotoPanel(ctx, img, px, py, pw, ph, cfg, grade) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(pw / iw, ph / ih);
  const s = base * (cfg.zoom || 1);
  const dw = iw * s;
  const dh = ih * s;
  let ox = px + pw / 2 - (cfg.fx ?? 0.5) * dw;
  let oy = py + ph / 2 - (cfg.fy ?? 0.5) * dh;
  ox = Math.min(px, Math.max(px + pw - dw, ox));
  oy = Math.min(py, Math.max(py + ph - dh, oy));
  ctx.filter = `saturate(${(1 + 0.28 * grade).toFixed(3)}) contrast(${(1 + 0.1 * grade).toFixed(3)}) brightness(${(1 + 0.03 * grade).toFixed(3)})`;
  ctx.drawImage(img, ox, oy, dw, dh);
  ctx.filter = 'none';
  applySunsetGrade(ctx, px, py, pw, ph, grade);
}

/** A procedural sunset when a panel has no photo yet. */
function drawSunsetPanel(ctx, px, py, pw, ph, seed, grade) {
  const sky = ctx.createLinearGradient(0, py, 0, py + ph);
  sky.addColorStop(0, '#2b1055');
  sky.addColorStop(0.45, '#7597de');
  sky.addColorStop(0.62, '#ff7e5f');
  sky.addColorStop(1, '#feb47b');
  ctx.fillStyle = sky;
  ctx.fillRect(px, py, pw, ph);
  // The sun, low over the sea.
  const sx = px + pw * (0.3 + 0.4 * ((seed * 37) % 10) / 10);
  const sy = py + ph * 0.6;
  const sr = Math.min(pw, ph) * 0.13;
  const sun = ctx.createRadialGradient(sx, sy, sr * 0.1, sx, sy, sr);
  sun.addColorStop(0, 'rgba(255, 244, 200, 1)');
  sun.addColorStop(0.6, 'rgba(255, 180, 90, 0.95)');
  sun.addColorStop(1, 'rgba(255, 120, 60, 0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();
  // The sea band.
  ctx.fillStyle = '#1d2b53';
  ctx.fillRect(px, py + ph * 0.68, pw, ph * 0.32);
  ctx.fillStyle = 'rgba(255, 190, 120, 0.35)';
  for (let i = 0; i < 5; i++) {
    const yy = py + ph * (0.72 + i * 0.05);
    ctx.fillRect(px + pw * 0.2, yy, pw * (0.25 + 0.1 * i), 2);
  }
  drawPalm(ctx, px + pw * 0.82, py + ph, Math.min(pw, ph) * 0.34);
  applySunsetGrade(ctx, px, py, pw, ph, grade);
}

/** A palm silhouette, drawn with quadratic curves. */
function drawPalm(ctx, bx, by, size) {
  ctx.save();
  ctx.translate(bx, by);
  ctx.strokeStyle = '#14081f';
  ctx.fillStyle = '#14081f';
  ctx.lineWidth = size * 0.05;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.08, -size * 0.5, size * 0.22, -size * 0.85);
  ctx.stroke();
  const topX = size * 0.22;
  const topY = -size * 0.85;
  for (let i = 0; i < 6; i++) {
    const a = (-0.15 - i * 0.28) * Math.PI;
    const ex = topX + Math.cos(a) * size * 0.42;
    const ey = topY + Math.sin(a) * size * 0.34 + size * 0.12;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(topX + (ex - topX) * 0.5, topY - size * 0.16, ex, ey);
    ctx.lineWidth = size * 0.035;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * The neon-sunset grade over a painted panel: a warm overlay wash, a
 * vignette that darkens the corners, and halftone print dots.
 */
function applySunsetGrade(ctx, px, py, pw, ph, grade) {
  if (grade <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  const wash = ctx.createLinearGradient(0, py, 0, py + ph);
  wash.addColorStop(0, `rgba(255, 154, 61, ${0.16 * grade})`);
  wash.addColorStop(0.55, 'rgba(255, 94, 122, 0)');
  wash.addColorStop(1, `rgba(255, 46, 136, ${0.26 * grade})`);
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = wash;
  ctx.fillRect(px, py, pw, ph);
  ctx.globalCompositeOperation = 'source-over';
  const vg = ctx.createRadialGradient(
    px + pw / 2, py + ph / 2, Math.min(pw, ph) * 0.42,
    px + pw / 2, py + ph / 2, Math.max(pw, ph) * 0.75,
  );
  vg.addColorStop(0, 'rgba(12, 0, 32, 0)');
  vg.addColorStop(1, `rgba(12, 0, 32, ${0.3 * grade})`);
  ctx.fillStyle = vg;
  ctx.fillRect(px, py, pw, ph);
  drawHalftone(ctx, px, py, pw, ph, grade);
  ctx.restore();
}

let halftonePattern = null;
/** Halftone dots, tiled as a pattern over the panel. */
function drawHalftone(ctx, px, py, pw, ph, grade) {
  if (!halftonePattern) {
    const tile = document.createElement('canvas');
    tile.width = 14;
    tile.height = 14;
    const t = tile.getContext('2d');
    t.fillStyle = 'rgba(20, 4, 40, 0.9)';
    t.beginPath();
    t.arc(3.5, 3.5, 1.6, 0, Math.PI * 2);
    t.fill();
    t.beginPath();
    t.arc(10.5, 10.5, 1.1, 0, Math.PI * 2);
    t.fill();
    halftonePattern = ctx.createPattern(tile, 'repeat');
  }
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.12 * grade;
  ctx.fillStyle = halftonePattern;
  ctx.fillRect(px, py, pw, ph);
  ctx.restore();
}

/** The caption: a dark scrim, the title in Anton, the subtitle below. */
function drawCaption(ctx, w, h, state) {
  const title = (state.title ?? '').trim().toUpperCase();
  const subtitle = (state.subtitle ?? '').trim().toUpperCase();
  const scrim = ctx.createLinearGradient(0, h * 0.68, 0, h);
  scrim.addColorStop(0, 'rgba(14, 5, 26, 0)');
  scrim.addColorStop(0.45, 'rgba(14, 5, 26, 0.62)');
  scrim.addColorStop(1, 'rgba(14, 5, 26, 0.92)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.68, w, h * 0.32);

  // The neon rule above the title.
  const rule = ctx.createLinearGradient(w * 0.1, 0, w * 0.9, 0);
  rule.addColorStop(0, '#ffb347');
  rule.addColorStop(0.5, '#ff2e88');
  rule.addColorStop(1, '#b537f2');
  ctx.fillStyle = rule;
  ctx.fillRect(w * 0.1, h * 0.795, w * 0.8, Math.max(3, h * 0.004));

  if (title) {
    let size = h * 0.115;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const setFont = (s) => { ctx.font = `${Math.round(s)}px Anton, 'Arial Narrow', Impact, sans-serif`; };
    setFont(size);
    while (ctx.measureText(title).width > w * 0.9 && size > 20) {
      size -= 2;
      setFont(size);
    }
    const ty = h * 0.915;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(18, 4, 30, 0.9)';
    ctx.lineWidth = Math.max(2, size * 0.09);
    ctx.strokeText(title, w / 2, ty);
    paintTitleFill(ctx, title, w / 2, ty, size, state.theme ?? 'sunset');
  }
  if (subtitle) {
    const size = Math.max(14, Math.round(h * 0.026));
    ctx.font = `600 ${size}px 'Arial Narrow', system-ui, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(size * 0.32)}px`; } catch { /* older canvas: no letter spacing */ }
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.fillText(subtitle, w / 2, h * 0.965);
    try { ctx.letterSpacing = '0px'; } catch { /* ignore */ }
  }
}

/** Fills the title text with the theme's paint (solid or gradient). */
function paintTitleFill(ctx, title, x, y, size, theme) {
  if (theme === 'sunset') {
    const g = ctx.createLinearGradient(0, y - size, 0, y);
    g.addColorStop(0, '#ffe259');
    g.addColorStop(0.55, '#ff7e5f');
    g.addColorStop(1, '#ff2e88');
    ctx.fillStyle = g;
  } else if (theme === 'neon') {
    ctx.fillStyle = '#ff2e88';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = size * 0.22;
  } else if (theme === 'gold') {
    const g = ctx.createLinearGradient(0, y - size, 0, y);
    g.addColorStop(0, '#fff3b0');
    g.addColorStop(1, '#e8a13c');
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = '#ffffff';
  }
  ctx.fillText(title, x, y);
  ctx.shadowBlur = 0;
}
