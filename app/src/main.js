// Neon Cover Studio — the editor wiring.
//
// Holds the cover state, loads photos, wires every control, renders
// the live preview, and exports the PNG at the exact post size. A
// `?shot=` query sets up a fixed scene for a screenshot instead
// (./shots.js). Photos are read on the machine and never uploaded.
import { drawCover, layoutPanels, defaultCrop, SIZES, LAYOUTS } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const panelName = document.getElementById('panel-name');
const zoomInput = document.getElementById('zoom');

/** The whole cover, as the editor understands it. */
const state = {
  sizeKey: 'wide',
  layoutKey: 'vice',
  title: 'Sunset Heist',
  subtitle: 'Neon Bay • 2026',
  theme: 'sunset',
  grade: 0.7,
  photos: [], // { img, name } — index 0 is the main photo
  panels: [], // { src, fx, fy, zoom } per panel, rebuilt per layout
  selected: 0,
};

const PANEL_NAMES = {
  vice: ['Hero', 'Top right', 'Bottom right'],
  strip: ['Hero band', 'Left', 'Middle', 'Right'],
  poster: ['Top left', 'Top right', 'Bottom left', 'Bottom right'],
};

/** Switches the panel layout, rebuilding the panel list for it. */
export function setLayout(layout) {
  state.layoutKey = layout;
  rebuildPanels();
  redraw();
}
function rebuildPanels() {
  const count = LAYOUTS[state.layoutKey].panels;
  const kept = state.panels.slice(0, count);
  while (kept.length < count) kept.push({ src: 0, ...defaultCrop(kept.length) });
  state.panels = kept;
  state.selected = Math.min(state.selected, count - 1);
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

let fontsReady = false;
/** Waits for the Anton display font, then repaints once it arrives. */
async function ensureFonts() {
  try {
    await document.fonts.load('100px Anton');
    await document.fonts.ready;
  } catch { /* fall back to the system condensed stack */ }
  fontsReady = true;
  redraw();
}

function redraw() {
  drawCover(canvas, state);
  syncPanelControls();
}

function syncPanelControls() {
  const names = PANEL_NAMES[state.layoutKey];
  panelName.textContent = names[state.selected] ?? `Panel ${state.selected + 1}`;
  const cfg = state.panels[state.selected];
  if (cfg) zoomInput.value = String(Math.round((cfg.zoom || 1) * 100));
}

/** Sets the main photo: every panel fills from it with a fresh crop. */
async function setMainPhoto(img, name) {
  state.photos = [{ img, name }];
  state.panels = state.panels.map((_, i) => ({ src: 0, ...defaultCrop(i) }));
  status.textContent = `Photo loaded: ${name}. Pick a layout, then Export PNG.`;
  redraw();
}

async function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    status.textContent = 'That file is not an image — pick a photo file.';
    return null;
  }
  try {
    return await loadImage(URL.createObjectURL(file));
  } catch {
    status.textContent = 'That photo could not be read. Try another file.';
    return null;
  }
}

// --- photo inputs -------------------------------------------------------
document.getElementById('photo').addEventListener('change', async (e) => {
  const img = await loadFile(e.target.files[0]);
  if (img) setMainPhoto(img, e.target.files[0].name);
  e.target.value = '';
});
document.getElementById('panel-photo').addEventListener('change', async (e) => {
  const img = await loadFile(e.target.files[0]);
  if (img) {
    state.photos.push({ img, name: e.target.files[0].name });
    state.panels[state.selected].src = state.photos.length - 1;
    status.textContent = 'This panel now uses its own photo.';
    redraw();
  }
  e.target.value = '';
});
document.querySelectorAll('[data-sample]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    try {
      const img = await loadImage(`samples/${btn.dataset.sample}.jpg`);
      setMainPhoto(img, `${btn.dataset.sample}.jpg`);
    } catch {
      status.textContent = 'The sample photo could not be loaded.';
    }
  });
});

// --- drag and drop ------------------------------------------------------
const dropzone = document.getElementById('dropzone');
['dragenter', 'dragover'].forEach((ev) => dropzone.addEventListener(ev, (e) => {
  e.preventDefault();
  dropzone.classList.add('drag');
}));
['dragleave', 'drop'].forEach((ev) => dropzone.addEventListener(ev, (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag');
}));
dropzone.addEventListener('drop', async (e) => {
  const img = await loadFile(e.dataTransfer.files[0]);
  if (img) setMainPhoto(img, e.dataTransfer.files[0].name);
});

// --- layout, caption, grade, size ---------------------------------------
function wireSegmented(id, attr, apply) {
  const root = document.getElementById(id);
  root.addEventListener('click', (e) => {
    const btn = e.target.closest(`[data-${attr}]`);
    if (!btn) return;
    root.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
    apply(btn.dataset[attr]);
  });
}
wireSegmented('layouts', 'layout', (v) => setLayout(v));
wireSegmented('themes', 'theme', (v) => { state.theme = v; redraw(); });
document.getElementById('title').addEventListener('input', (e) => { state.title = e.target.value; redraw(); });
document.getElementById('subtitle').addEventListener('input', (e) => { state.subtitle = e.target.value; redraw(); });
document.getElementById('grade').addEventListener('input', (e) => { state.grade = e.target.value / 100; redraw(); });
document.getElementById('size').addEventListener('change', (e) => { state.sizeKey = e.target.value; redraw(); });
zoomInput.addEventListener('input', () => {
  const cfg = state.panels[state.selected];
  if (cfg) { cfg.zoom = zoomInput.value / 100; redraw(); }
});
document.getElementById('panel-main').addEventListener('click', () => {
  const i = state.selected;
  state.panels[i] = { src: 0, ...defaultCrop(i) };
  redraw();
});
document.getElementById('panel-reset').addEventListener('click', () => {
  const i = state.selected;
  const src = state.panels[i]?.src ?? 0;
  state.panels[i] = { src, ...defaultCrop(i) };
  redraw();
});

// --- export -------------------------------------------------------------
document.getElementById('export').addEventListener('click', () => {
  const size = SIZES[state.sizeKey];
  const off = document.createElement('canvas');
  drawCover(off, state);
  off.toBlob((blob) => {
    if (!blob) { status.textContent = 'Export failed — try again.'; return; }
    const name = `neon-cover-${state.sizeKey}-${size.w}x${size.h}.png`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    window.__lastExport = { name, width: size.w, height: size.h, bytes: blob.size };
    status.textContent = `Saved ${name} (${size.w} × ${size.h}).`;
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
  }, 'image/png');
});

// --- preview: click to select a panel, drag to move its photo -----------
function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}
function panelAt(x, y) {
  const rects = layoutPanels(state.layoutKey, canvas.width, canvas.height);
  return rects.findIndex((r) => x >= r.x * canvas.width && x < (r.x + r.w) * canvas.width
    && y >= r.y * canvas.height && y < (r.y + r.h) * canvas.height);
}
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const p = canvasPoint(e);
  const i = panelAt(p.x, p.y);
  if (i < 0) return;
  state.selected = i;
  syncPanelControls();
  canvas.setPointerCapture(e.pointerId);
  drag = { x: p.x, y: p.y, moved: false };
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const dx = p.x - drag.x;
  const dy = p.y - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
  const cfg = state.panels[state.selected];
  const photo = state.photos[cfg?.src ?? 0];
  if (cfg && photo) {
    const iw = photo.img.naturalWidth;
    const ih = photo.img.naturalHeight;
    const rects = layoutPanels(state.layoutKey, canvas.width, canvas.height);
    const r = rects[state.selected];
    const base = Math.max((r.w * canvas.width) / iw, (r.h * canvas.height) / ih);
    const s = base * (cfg.zoom || 1);
    cfg.fx = Math.min(1, Math.max(0, cfg.fx - dx / (iw * s)));
    cfg.fy = Math.min(1, Math.max(0, cfg.fy - dy / (ih * s)));
    redraw();
  }
  drag.x = p.x;
  drag.y = p.y;
});
canvas.addEventListener('pointerup', () => { drag = null; });

// --- start ---------------------------------------------------------------
rebuildPanels();
const query = new URLSearchParams(location.search);
if (query.get('shot')) {
  if (query.get('shot') === 'cover') document.body.classList.add('shot-cover');
  runShot(query, { setMainPhoto, setLayout, state, redraw, ensureFonts, canvas, loadImage });
} else {
  ensureFonts();
  redraw();
}
