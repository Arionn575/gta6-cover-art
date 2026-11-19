// Fixed scenes for screenshots: ?shot=cover shows the cover alone at
// its export size, ?shot=editor shows the editor with a photo loaded.
// Query params: photo (pier|boulevard), layout, size, title, subtitle,
// theme, grade. window.__shotReady is set once painted.
export async function runShot(query, app) {
  const shot = query.get('shot');
  const photoName = query.get('photo') ?? 'pier';
  const layout = query.get('layout') ?? 'vice';
  const sizeKey = query.get('size') ?? 'wide';
  const title = query.get('title') ?? 'Sunset Heist';
  const subtitle = query.get('subtitle') ?? 'Neon Bay • 2026';
  const theme = query.get('theme') ?? 'sunset';
  const grade = Number(query.get('grade') ?? '70') / 100;

  app.setLayout(layout);
  app.state.sizeKey = sizeKey;
  app.state.title = title;
  app.state.subtitle = subtitle;
  app.state.theme = theme;
  app.state.grade = Number.isFinite(grade) ? grade : 0.7;
  document.getElementById('title').value = title;
  document.getElementById('subtitle').value = subtitle;
  document.getElementById('grade').value = String(Math.round(app.state.grade * 100));
  document.getElementById('size').value = sizeKey;
  document.querySelectorAll('#layouts button').forEach((b) => b.classList.toggle('on', b.dataset.layout === layout));
  document.querySelectorAll('#themes button').forEach((b) => b.classList.toggle('on', b.dataset.theme === theme));

  const img = await app.loadImage(`samples/${photoName}.jpg`);
  await app.setMainPhoto(img, `${photoName}.jpg`);
  await app.ensureFonts();
  app.redraw();

  if (shot === 'cover') {
    // Fit the export-size canvas inside the viewport, keeping its shape.
    const cw = app.canvas.width;
    const ch = app.canvas.height;
    const scale = Math.min(window.innerWidth / cw, window.innerHeight / ch);
    app.canvas.style.width = `${Math.floor(cw * scale)}px`;
    app.canvas.style.height = `${Math.floor(ch * scale)}px`;
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
