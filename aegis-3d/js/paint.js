/* lowpoly/js/paint.js — the painterly wet-oil texture factory.
   Neon Reliquary translated to 3D: bold flat brushwork, hard faceted geometry,
   hued shadows, halftone grain. Everything here is procedural and seeded, so
   the whole visual identity ships as code, the way the 2D game ships sprites.

   Exposes window.Paint:
     Paint.palette(key) -> { mid, dark, light, spark }
     Paint.tex(paletteKey, seed, opts) -> THREE.CanvasTexture (cached)
     Paint.mat(paletteKey, seed, opts) -> MeshStandardMaterial (flat-shaded)
     Paint.sky() -> THREE.CanvasTexture (vaporwave sky + painted nebula + stars)
     Paint.glyph(kind) -> THREE.CanvasTexture (element mark glyph)
     Paint.emblem(commanderId) -> canvas (UI crest, painted in code)         */
(function () {
  'use strict';
  const { mulberry32, hashStr } = Util;

  /* Brand palettes (docs/BRAND.md). Ground is always void black; each faction
     owns its ramp to the point of monochrome. */
  const PALETTES = {
    human:   { mid: '#164e63', dark: '#0a0e17', light: '#38e8ff', spark: '#ff2fd6' },
    light:   { mid: '#78350f', dark: '#0a0e17', light: '#fbbf24', spark: '#fff7e0' },
    xeno:    { mid: '#3b0764', dark: '#0a0e17', light: '#a855f7', spark: '#ff2fd6' },
    pirate:  { mid: '#7f1d1d', dark: '#0a0e17', light: '#ef4444', spark: '#ff6b6b' },
    chrome:  { mid: '#334155', dark: '#0f172a', light: '#94a3b8', spark: '#e2e8f0' },
    stone:   { mid: '#57534e', dark: '#1c1917', light: '#a8a29e', spark: '#e7e5e4' },
    moss:    { mid: '#14532d', dark: '#052e16', light: '#4ade80', spark: '#bbf7d0' },
    ember:   { mid: '#7f1d1d', dark: '#1c0a0a', light: '#f97316', spark: '#fde68a' },
    storm:   { mid: '#1e3a8a', dark: '#0a0e17', light: '#60a5fa', spark: '#c4b5fd' },
    ven:     { mid: '#14532d', dark: '#052e16', light: '#a3e635', spark: '#d9f99d' },
    terrain: { mid: '#3f2d4d', dark: '#171226', light: '#6d5486', spark: '#b79bd6' },
    path:    { mid: '#2a2438', dark: '#14101f', light: '#4a4160', spark: '#8b7fb5' },
    metal:   { mid: '#1e293b', dark: '#0b1220', light: '#64748b', spark: '#cbd5e1' }
  };

  const _texCache = {};
  const _matCache = {};

  function hexRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function css(hx, a) {
    const [r, g, b] = typeof hx === 'string' ? hexRgb(hx) : hx;
    return a === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
  }

  /* ------------------------------------------------------------------ */
  /* The oil-paint procedure. 160x160. */
  function paintCanvas(pal, seed, size) {
    const n = size || 160;
    const cv = document.createElement('canvas');
    cv.width = n; cv.height = n;
    const ctx = cv.getContext('2d');
    const R = mulberry32(seed);

    const mid = hexRgb(pal.mid), dark = hexRgb(pal.dark),
          light = hexRgb(pal.light), spark = hexRgb(pal.spark);

    /* Ground: dark void, slightly hued. */
    ctx.fillStyle = css(pal.dark);
    ctx.fillRect(0, 0, n, n);

    /* Big soft under-paint blotches: the colour masses that do the drawing. */
    for (let i = 0; i < 26; i++) {
      const pick = i % 3 === 0 ? spark : (R() < 0.55 ? light : mid);
      const x = R() * n, y = R() * n, r = n * (0.16 + R() * 0.3);
      const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
      g.addColorStop(0, css(pick, 0.16 + R() * 0.14));
      g.addColorStop(1, css(pick, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, n, n);
    }

    /* Directional brush strokes — the Tyranny "flat bold brushwork". */
    const dir = (R() * Math.PI);
    for (let i = 0; i < 44; i++) {
      const pick = R() < 0.5 ? light : (R() < 0.5 ? mid : spark);
      const len = n * (0.18 + R() * 0.42);
      const w = n * (0.03 + R() * 0.06);
      const x = R() * n, y = R() * n;
      const a = dir + (R() - 0.5) * 0.9;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      const g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, css(pick, 0));
      g.addColorStop(0.45, css(pick, 0.10 + R() * 0.16));
      g.addColorStop(1, css(pick, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(0, -w / 2, len, w, w / 2) : ctx.rect(0, -w / 2, len, w);
      ctx.fill();
      ctx.restore();
    }

    /* Wet blend: the canvas smears itself — the "wet oil" pass. */
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.globalCompositeOperation = 'multiply';
    const smear = 4 + Math.floor(R() * 5);
    ctx.drawImage(cv, smear, smear * 0.6);
    ctx.drawImage(cv, -smear, smear * 0.35);
    ctx.restore();

    /* Hard dabs: opaque paint placed last, on top — impasto highlights. */
    for (let i = 0; i < 22; i++) {
      const pick = R() < 0.62 ? light : spark;
      const x = R() * n, y = R() * n, r = n * (0.02 + R() * 0.05);
      ctx.fillStyle = css(pick, 0.20 + R() * 0.25);
      ctx.beginPath();
      ctx.ellipse(x, y, r * (0.6 + R()), r * (0.6 + R()), R() * 6.28, 0, 6.283);
      ctx.fill();
    }

    /* Halftone screen-print grain: dark dots at fixed pitch, subtle. */
    const pitch = Math.max(4, Math.floor(n / 26));
    ctx.fillStyle = css(pal.dark, 0.30);
    for (let gy = pitch / 2; gy < n; gy += pitch) {
      for (let gx = pitch / 2; gx < n; gx += pitch) {
        const d = pitch * (0.28 + 0.2 * Math.sin(gx * 0.9 + gy * 0.7));
        ctx.beginPath();
        ctx.arc(gx, gy, d, 0, 6.283);
        ctx.fill();
      }
    }

    /* Hued edge shading so facets read even where texture wraps. */
    const vg = ctx.createRadialGradient(n / 2, n / 2, n * 0.3, n / 2, n / 2, n * 0.78);
    vg.addColorStop(0, css(dark, 0));
    vg.addColorStop(1, css(dark, 0.5));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, n, n);

    return cv;
  }

  function tex(paletteKey, seed, opts) {
    const o = opts || {};
    const size = o.size || 160;
    const key = paletteKey + '|' + seed + '|' + size;
    if (_texCache[key]) return _texCache[key];
    const pal = PALETTES[paletteKey] || PALETTES.chrome;
    const cv = paintCanvas(pal, seed, size);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    _texCache[key] = t;
    return t;
  }

  function mat(paletteKey, seed, opts) {
    const o = opts || {};
    const key = 'm|' + paletteKey + '|' + seed + '|' + (o.size || 160) + '|' + (o.emissive || 0) + '|' + (o.rough || 0);
    if (_matCache[key]) return _matCache[key];
    const m = new THREE.MeshStandardMaterial({
      map: tex(paletteKey, seed, o),
      flatShading: true,
      roughness: o.rough === undefined ? 0.86 : o.rough,
      metalness: 0.06
    });
    if (o.emissive) {
      m.emissive = new THREE.Color(PALETTES[paletteKey].light);
      m.emissiveIntensity = o.emissive;
    }
    _matCache[key] = m;
    return m;
  }

  /* ------------------------------------------------------------------ */
  /* Sky: void black dome, painted nebula, hued horizon, stars. */
  function sky() {
    if (_texCache['sky']) return _texCache['sky'];
    const W = 1024, H = 512;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const R = mulberry32(7777);

    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05060d');
    g.addColorStop(0.45, '#0a0e17');
    g.addColorStop(0.78, '#1d1040');
    g.addColorStop(0.92, '#3d1457');
    g.addColorStop(1, '#ff2fd6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    /* Painted nebula: big soft magenta/cyan masses near the horizon. */
    const blobs = [[0.22, 0.72, 0.5, '#ff2fd6'], [0.7, 0.66, 0.42, '#38e8ff'],
                   [0.5, 0.8, 0.55, '#7c3aed'], [0.88, 0.75, 0.3, '#ff2fd6']];
    for (const [bx, by, br, col] of blobs) {
      for (let i = 0; i < 6; i++) {
        const x = W * (bx + (R() - 0.5) * 0.3);
        const y = H * (by + (R() - 0.5) * 0.2);
        const r = W * br * (0.3 + R() * 0.5);
        const rg = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
        rg.addColorStop(0, col.replace('#', '#') + '');
        const colRgb = hexRgb(col);
        rg.addColorStop(0, `rgba(${colRgb[0]},${colRgb[1]},${colRgb[2]},${0.10 + R() * 0.08})`);
        rg.addColorStop(1, `rgba(${colRgb[0]},${colRgb[1]},${colRgb[2]},0)`);
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, H);
      }
    }

    /* Stars. */
    for (let i = 0; i < 520; i++) {
      const x = R() * W, y = R() * H * 0.82;
      const r = R() < 0.92 ? 0.6 + R() * 0.8 : 1.4 + R() * 1.2;
      ctx.fillStyle = `rgba(226,232,240,${0.25 + R() * 0.75})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 6.283);
      ctx.fill();
    }
    /* A few cross-flare stars. */
    for (let i = 0; i < 12; i++) {
      const x = R() * W, y = R() * H * 0.7;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y);
      ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6);
      ctx.stroke();
    }

    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    _texCache['sky'] = t;
    return t;
  }

  /* ------------------------------------------------------------------ */
  /* Element glyphs: drawn shapes, not font glyphs (cross-platform stable). */
  function glyph(kind) {
    const key = 'glyph|' + kind;
    if (_texCache[key]) return _texCache[key];
    const cv = document.createElement('canvas');
    cv.width = cv.height = 96;
    const ctx = cv.getContext('2d');
    const col = kind === 'fire' ? '#fb923c' : kind === 'frost' ? '#7dd3fc'
      : kind === 'storm' ? '#a5b4fc' : kind === 'venom' ? '#a3e635'
      : kind === 'void' ? '#c084fc' : kind === 'radiant' ? '#fbbf24' : '#e2e8f0';
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const c = 48;
    ctx.beginPath();
    switch (kind) {
      case 'fire':
        ctx.moveTo(c, 14); ctx.lineTo(c + 22, c); ctx.lineTo(c + 6, c);
        ctx.lineTo(c + 14, 82); ctx.lineTo(c - 14, 82); ctx.lineTo(c - 6, c);
        ctx.lineTo(c - 22, c); ctx.closePath(); ctx.fill(); break;
      case 'frost':
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          ctx.moveTo(c, c); ctx.lineTo(c + 30 * Math.cos(a), c + 30 * Math.sin(a));
        }
        ctx.stroke(); break;
      case 'storm':
        ctx.moveTo(c + 14, 12); ctx.lineTo(c - 16, 52); ctx.lineTo(c - 2, 52);
        ctx.lineTo(c - 14, 84); ctx.lineTo(c + 16, 44); ctx.lineTo(c + 2, 44);
        ctx.closePath(); ctx.fill(); break;
      case 'venom':
        ctx.beginPath(); ctx.arc(c - 12, c + 12, 8, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(c + 12, c - 12, 12, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.arc(c - 14, c - 18, 5, 0, 6.283); ctx.fill(); break;
      case 'void':
        ctx.beginPath(); ctx.arc(c, c, 26, 0, 6.283); ctx.stroke();
        ctx.beginPath(); ctx.arc(c, c, 9, 0, 6.283); ctx.fill(); break;
      case 'radiant':
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const l = i % 2 === 0 ? 30 : 14;
          ctx.moveTo(c + 8 * Math.cos(a), c + 8 * Math.sin(a));
          ctx.lineTo(c + l * Math.cos(a), c + l * Math.sin(a));
        }
        ctx.stroke(); break;
      default:
        ctx.beginPath(); ctx.arc(c, c, 24, 0, 6.283); ctx.stroke();
        ctx.beginPath(); ctx.arc(c, c, 5, 0, 6.283); ctx.fill();
    }
    const t = new THREE.CanvasTexture(cv);
    _texCache[key] = t;
    return t;
  }

  /* ------------------------------------------------------------------ */
  /* Commander emblems: engraved reliquary ring, faction hue, no other colour. */
  function emblem(commanderId) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 192;
    const ctx = cv.getContext('2d');
    const key = commanderId.toLowerCase();
    const fac = key === 'vanta' ? 'human' : key === 'seraph' ? 'light'
      : key === 'sevra' ? 'xeno' : 'pirate';
    const pal = PALETTES[fac];
    const R = mulberry32(hashStr(commanderId));
    const c = 96;

    ctx.fillStyle = css(pal.dark);
    ctx.fillRect(0, 0, 192, 192);

    /* Rose-window geometry: layered arcs + radial spokes, engraved feel. */
    ctx.strokeStyle = css(pal.mid, 0.9);
    ctx.lineWidth = 3;
    for (let ring = 0; ring < 3; ring++) {
      ctx.beginPath();
      ctx.arc(c, c, 30 + ring * 24, 0, 6.283);
      ctx.stroke();
    }
    const spokes = 12 + Math.floor(R() * 4);
    ctx.strokeStyle = css(pal.mid, 0.55);
    ctx.lineWidth = 2;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + R() * 0.2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * 34, c + Math.sin(a) * 34);
      ctx.lineTo(c + Math.cos(a) * 76, c + Math.sin(a) * 76);
      ctx.stroke();
    }

    /* Inner sigil: a seeded hard shape, unique per commander. */
    ctx.fillStyle = css(pal.light);
    ctx.strokeStyle = css(pal.light);
    ctx.lineWidth = 4;
    const sigil = R() * 4 | 0;
    if (sigil === 0) {          // archivist: open eye / arc
      ctx.beginPath(); ctx.arc(c, c, 22, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      ctx.beginPath(); ctx.arc(c, c + 6, 9, 0, 6.283); ctx.fill();
    } else if (sigil === 1) {   // radiant: sun disc + rays
      ctx.beginPath(); ctx.arc(c, c, 20, 0, 6.283); ctx.fill();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * 24, c + Math.sin(a) * 24);
        ctx.lineTo(c + Math.cos(a) * 34, c + Math.sin(a) * 34);
        ctx.lineWidth = 3; ctx.stroke();
      }
    } else if (sigil === 2) {   // necrotist: descending triad
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(c - 18 + i * 18, c - 22 + i * 12);
        ctx.lineTo(c + 2 + i * 18, c + 2 + i * 12);
        ctx.lineTo(c - 34 + i * 18, c + 2 + i * 12);
        ctx.closePath(); ctx.fill();
      }
    } else {                    // corsair: crossed blades
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(c - 22, c - 20); ctx.lineTo(c + 22, c + 20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c + 22, c - 20); ctx.lineTo(c - 22, c + 20); ctx.stroke();
    }
    /* Spark: one rim light, no third colour. */
    ctx.strokeStyle = css(pal.spark, 0.9);
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(c, c, 84, -2.4, -1.2); ctx.stroke();
    return cv;
  }

  window.Paint = {
    palette: (k) => PALETTES[k] || PALETTES.chrome,
    tex, mat, sky, glyph, emblem,
    css, hexRgb
  };
})();
