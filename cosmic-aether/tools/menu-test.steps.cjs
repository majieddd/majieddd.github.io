module.exports = [
  { size: [1600, 900] },
  { wait: 3000 },
  { shot: 'menu-live' },
  { eval: '(function(){ var btns = Array.prototype.map.call(document.querySelectorAll("button, .card, [data-board], .board"), function(b){ var t=(b.textContent||"").replace(/\s+/g," ").trim(); return t.length>0 && t.length<60 ? t : null; }).filter(Boolean).slice(0, 24); return JSON.stringify({menuItems: btns}); })()' }
];
