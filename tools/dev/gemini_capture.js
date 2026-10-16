// Paste into the Gemini conversation page (via the Chrome extension's javascript tool)
// when Chrome blocks automatic downloads. It fetches the full-size image behind a
// "下載原尺寸圖片" button, shows it in a full-screen overlay, and lets you screenshot it in tiles.
//
//   await __grab(i, cssWidth)  // i = button index (negative counts from the end); returns [.., naturalW, naturalH, displayedH, innerHeight]
//   __tile(k)                  // scroll the overlay to tile k; returns the CSS top offset to pass to stitch_tiles.py
//   document.getElementById('__ov').remove()   // when done
//
// Widths that worked: 1900 for 16:9 or 3:2 images (2 tiles), 1300 for squares (2 tiles), 1000 for 9:16 (2 tiles).
// Hover the mouse at the far right edge before screenshots so the cursor is outside the image.
window.__grab = async function (i, cssW) {
  cssW = cssW || 1900;
  performance.clearResourceTimings(); performance.setResourceTimingBufferSize(5000);
  document.getElementById('__ov')?.remove();
  const b = [...document.querySelectorAll('button[aria-label="下載原尺寸圖片"]')];
  if (i < 0) i = b.length + i;
  b[i].click();
  let found = null;
  for (let t = 0; t < 12 && !found; t++) {
    await new Promise(r => setTimeout(r, 2500));
    const es = performance.getEntriesByType('resource').map(x => x.name).filter(n => n.includes('rd-gg'));
    for (const u0 of es.reverse()) {
      let u = u0;
      for (let k = 0; k < 4; k++) {   // the download URL may answer with another URL as text
        try {
          const r = await fetch(u, { credentials: 'include' }); const ct = r.headers.get('content-type') || ''; const bl = await r.blob();
          if (ct.startsWith('image') && bl.size > 4e5) { found = bl; break; }
          if (ct.startsWith('text')) { u = (await bl.text()).trim(); continue; }
          break;
        } catch (e) { break; }
      }
      if (found) break;
    }
  }
  if (!found) return 'none';
  const d = document.createElement('div'); d.id = '__ov';
  d.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#000;overflow:hidden';
  const im = document.createElement('img'); im.id = '__im';
  im.style.cssText = 'position:absolute;left:0;top:0;width:' + cssW + 'px;height:auto';
  d.appendChild(im); document.body.appendChild(d);   // no innerHTML: Gemini enforces Trusted Types
  await new Promise(r => { im.onload = r; im.src = URL.createObjectURL(found); });
  return [b.length, found.size, im.naturalWidth, im.naturalHeight, im.height, innerHeight];
};
window.__tile = function (k) {
  const im = document.getElementById('__im'), H = im.height, V = innerHeight;
  const top = Math.min(k * V, Math.max(0, H - V));
  im.style.top = (-top) + 'px';
  return top;
};
