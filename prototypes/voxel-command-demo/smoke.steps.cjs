module.exports = [
  { size: [1440, 960] },
  { wait: 800 },
  { eval: `(() => ({
    api: Boolean(window.VoxelDemo),
    canvas: { width: document.getElementById('field').width, height: document.getElementById('field').height },
    phase: document.getElementById('phase-readout').textContent.trim(),
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    wrapped: [...document.querySelectorAll('button')].filter((button) => button.scrollHeight > button.clientHeight + 1).map((button) => button.textContent.trim())
  }))()` },
  { eval: `(() => {
    const canvas = document.getElementById('field');
    const rect = canvas.getBoundingClientRect();
    const pad = VoxelDemo.getPadScreens()[0];
    canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: rect.left + pad.x, clientY: rect.top + pad.y }));
    return { canvasBuilt: VoxelDemo.snapshot().towers, state: VoxelDemo.snapshot() };
  })()` },
  { eval: `(() => ({ cryo: VoxelDemo.build('cryo', 1), mortar: VoxelDemo.build('mortar', 2), state: VoxelDemo.snapshot() }))()` },
  { eval: `(() => { VoxelDemo.start(); return VoxelDemo.snapshot(); })()` },
  { wait: 2500 },
  { eval: `(() => ({
    state: VoxelDemo.snapshot(),
    phase: document.getElementById('phase-readout').textContent.trim(),
    canvasInk: (() => { const c = document.getElementById('field'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n += 1; return n; })()
  }))()` },
  { eval: `(() => { document.getElementById('turn-right').click(); document.getElementById('zoom-in').click(); return VoxelDemo.snapshot(); })()` },
  { wait: 300 },
  { shot: 'desktop-wave' },
  { size: [390, 844] },
  { wait: 500 },
  { eval: `(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    phase: document.getElementById('phase-readout').textContent.trim(),
    focus: (() => { const el = document.getElementById('turn-left'); el.focus(); const s = getComputedStyle(el); return { active: document.activeElement === el, outline: s.outlineStyle, width: s.outlineWidth }; })()
  }))()` },
  { shot: 'mobile-wave' }
];
